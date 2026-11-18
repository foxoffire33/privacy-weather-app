import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, TimeoutError } from '../../core/appError';
import { configureDataLayer } from '../../core/config';
import { isRecord } from '../../core/guards';
import { responseGet, responsePut } from '../../core/idb';
import { useDiagnosticsStore } from '../../diagnosticsStore';
import { cachedJson, getJson } from '../client';

import type * as Idb from '../../core/idb';
import type { ResponseRecord } from '../../core/types';

vi.mock('../../core/idb', async (importOriginal) => {
  const actual = await importOriginal<typeof Idb>();
  return { ...actual, responseGet: vi.fn(), responsePut: vi.fn() };
});

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers });
}

function temp(body: unknown): number {
  if (isRecord(body) && typeof body.temperature === 'number') { return body.temperature; }
  throw new Error('invalid forecast');
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') { return input; }
  return input instanceof URL ? input.href : input.url;
}

async function miss(): Promise<ResponseRecord | undefined> {
  await Promise.resolve();
  return undefined;
}

function fresh(): void {
  vi.mocked(responseGet).mockImplementation(miss);
  vi.mocked(responsePut).mockResolvedValue();
}

function fetchOk(): void {
  configureDataLayer({
    fetch: async () => {
      await Promise.resolve();
      return json({ temperature: 5 }, 200);
    },
  });
}

afterEach(() => {
  configureDataLayer({ fetch: null, server: '' });
  vi.mocked(responseGet).mockReset();
  vi.mocked(responsePut).mockReset();
  useDiagnosticsStore.getState().clear();
  vi.useRealTimers();
});

describe('getJson retries', () => {
  it('keeps a same-origin proxy and blocks invalid saved servers without a public fallback', async () => {
    const urls: string[] = [];
    const mockFetch = async (input: RequestInfo | URL): Promise<Response> => {
      urls.push(urlOf(input));
      await Promise.resolve();
      return json({ temperature: 5 }, 200);
    };
    configureDataLayer({ server: '/weather', fetch: mockFetch });
    await getJson('forecast', '/v1/forecast', {});
    expect(urls).toEqual(['/weather/v1/forecast?']);
    configureDataLayer({ server: '//unintended.example', fetch: mockFetch });
    await expect(getJson('forecast', '/v1/forecast', {})).rejects.toMatchObject({ status: 400 });
    expect(urls).toHaveLength(1);
  });
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

describe('cachedJson', () => {
  it('serves a fresh cache hit without a network call', async () => {
    fresh();
    vi.mocked(responseGet).mockResolvedValue({ fetchedAt: Date.now(), expiresAt: Date.now() + 60_000, body: { temperature: 7 } });
    let calls = 0;
    configureDataLayer({
      fetch: async () => {
        calls += 1;
        await Promise.resolve();
        return json({ temperature: 5 }, 200);
      },
    });
    const before = useDiagnosticsStore.getState().metrics;
    await expect(cachedJson('forecast', '/v1/forecast', {}, { maxAgeMs: 60_000, build: temp })).resolves.toBe(7);
    expect(calls).toBe(0);
    const { metrics } = useDiagnosticsStore.getState();
    expect(metrics.loads).toBe(before.loads + 1);
    expect(metrics.cacheHits).toBe(before.cacheHits + 1);
  });

  it('falls back to the network and records a diagnostic when the cache read fails', async () => {
    fresh();
    vi.mocked(responseGet).mockRejectedValue(new DOMException('gone', 'AbortError'));
    fetchOk();
    await expect(cachedJson('forecast', '/v1/forecast', {}, { maxAgeMs: 60_000, build: temp })).resolves.toBe(5);
    const entry = useDiagnosticsStore.getState().entries.at(-1);
    expect(entry).toMatchObject({ kind: 'failure', name: 'response-cache read' });
  });

  it('returns the network value and records a diagnostic when the cache write fails', async () => {
    fresh();
    vi.mocked(responsePut).mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    fetchOk();
    await expect(cachedJson('forecast', '/v1/forecast', {}, { maxAgeMs: 60_000, build: temp })).resolves.toBe(5);
    const entry = useDiagnosticsStore.getState().entries.at(-1);
    expect(entry).toMatchObject({ kind: 'failure', name: 'response-cache write' });
  });

  it('stamps fetchedAt after the network response is fetched', async () => {
    vi.useFakeTimers();
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);
    fresh();
    configureDataLayer({
      fetch: async () => {
        await new Promise<void>((resolve) => { setTimeout(resolve, 5000); });
        return json({ temperature: 5 }, 200);
      },
    });
    const settled = cachedJson('forecast', '/v1/forecast', {}, { maxAgeMs: 60_000, build: temp });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(settled).resolves.toBe(5);
    expect(vi.mocked(responsePut)).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fetchedAt: start + 5000 }));
  });

  it('skips the cache read on a forced refresh', async () => {
    vi.mocked(responseGet).mockRejectedValue(new DOMException('boom', 'AbortError'));
    vi.mocked(responsePut).mockResolvedValue();
    fetchOk();
    await expect(cachedJson('forecast', '/v1/forecast', {}, { maxAgeMs: 0, build: temp })).resolves.toBe(5);
    expect(vi.mocked(responseGet)).not.toHaveBeenCalled();
    expect(useDiagnosticsStore.getState().entries).toEqual([]);
  });
});
