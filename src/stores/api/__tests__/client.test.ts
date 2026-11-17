import { afterEach, describe, expect, it, vi } from 'vitest';

import { configureDataLayer } from '../../core/config';
import { ApiError, TimeoutError, getJson } from '../client';

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers });
}

afterEach(() => {
  configureDataLayer({ fetch: null });
  vi.useRealTimers();
});

describe('getJson retries', () => {
  it('retries a 503 and returns the successful body', async () => {
    let calls = 0;
    configureDataLayer({
      fetch: async () => {
        calls += 1;
        await Promise.resolve();
        return calls === 1 ? json({ error: true, reason: 'busy' }, 503) : json({ temperature: 5 }, 200);
      },
    });
    await expect(getJson('forecast', '/v1/forecast', {})).resolves.toEqual({ temperature: 5 });
    expect(calls).toBe(2);
  });

  it('does not retry a 400 validation error', async () => {
    let calls = 0;
    configureDataLayer({
      fetch: async () => {
        calls += 1;
        await Promise.resolve();
        return json({ error: true, reason: 'bad coordinates' }, 400);
      },
    });
    const caught: unknown = await getJson('forecast', '/v1/forecast', {}).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toHaveProperty('status', 400);
    expect(caught).toHaveProperty('message', 'bad coordinates');
    expect(calls).toBe(1);
  });

  it('waits the Retry-After delay before retrying a 429', async () => {
    vi.useFakeTimers();
    let calls = 0;
    configureDataLayer({
      fetch: async () => {
        calls += 1;
        await Promise.resolve();
        return calls === 1
          ? json({ error: true, reason: 'slow down' }, 429, { 'retry-after': '1' })
          : json({ ok: 1 }, 200);
      },
    });
    const settled = getJson('forecast', '/v1/forecast', {}).then(
      (body: unknown) => body,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(settled).resolves.toEqual({ ok: 1 });
    expect(calls).toBe(2);
  });

  it('caps the Retry-After delay', async () => {
    vi.useFakeTimers();
    let calls = 0;
    configureDataLayer({
      fetch: async () => {
        calls += 1;
        await Promise.resolve();
        return calls === 1
          ? json({ error: true, reason: 'slow down' }, 429, { 'retry-after': '120' })
          : json({ ok: 1 }, 200);
      },
    });
    const settled = getJson('forecast', '/v1/forecast', {}).then(
      (body: unknown) => body,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(59_999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(settled).resolves.toEqual({ ok: 1 });
    expect(calls).toBe(2);
  });

  it('honors a Retry-After HTTP date', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const base = Math.floor(Date.now() / 1000) * 1000;
    const date = new Date(base + 6000).toUTCString();
    configureDataLayer({
      fetch: async () => {
        calls += 1;
        await Promise.resolve();
        return calls === 1
          ? json({ error: true, reason: 'slow down' }, 429, { 'retry-after': date })
          : json({ ok: 1 }, 200);
      },
    });
    const settled = getJson('forecast', '/v1/forecast', {}).then(
      (body: unknown) => body,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1001);
    await expect(settled).resolves.toEqual({ ok: 1 });
    expect(calls).toBe(2);
  });
});

describe('getJson cancellation', () => {
  it('stops retrying when the caller aborts during the backoff', async () => {
    vi.useFakeTimers();
    let calls = 0;
    configureDataLayer({
      fetch: async () => {
        calls += 1;
        await Promise.resolve();
        throw new TypeError('network failure');
      },
    });
    const caller = new AbortController();
    const settled = getJson('forecast', '/v1/forecast', {}, caller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(0);
    caller.abort(new Error('stopped'));
    const caught: unknown = await settled;
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toHaveProperty('message', 'stopped');
    expect(calls).toBe(1);
  });

  it('times out a hung request with a timeout error, not a cancellation', async () => {
    vi.useFakeTimers();
    let calls = 0;
    configureDataLayer({
      fetch: async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => new Promise<Response>((_resolve, reject) => {
        calls += 1;
        const signal = init?.signal;
        if (signal !== undefined && signal !== null) {
          signal.addEventListener('abort', () => { reject(signal.reason instanceof Error ? signal.reason : new Error('aborted')); }, { once: true });
        }
      }),
    });
    const caller = new AbortController();
    const settled = getJson('forecast', '/v1/forecast', {}, caller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(30_200);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(30_400);
    expect(calls).toBe(3);
    await vi.advanceTimersByTimeAsync(30_800);
    const caught: unknown = await settled;
    expect(caught).toBeInstanceOf(TimeoutError);
    expect(caller.signal.aborted).toBe(false);
  });

  it('rejects with the caller reason when the caller signal is already aborted', async () => {
    let calls = 0;
    configureDataLayer({
      fetch: async () => {
        calls += 1;
        await Promise.resolve();
        return json({ ok: 1 }, 200);
      },
    });
    const caller = new AbortController();
    caller.abort(new Error('already'));
    const caught: unknown = await getJson('forecast', '/v1/forecast', {}, caller.signal).catch((error: unknown) => error);
    expect(caught).toBe(caller.signal.reason);
    expect(calls).toBe(1);
  });
});
