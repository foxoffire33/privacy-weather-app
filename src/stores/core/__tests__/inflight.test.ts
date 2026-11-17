import { describe, expect, it } from 'vitest';

import { latest, once, READY } from '../inflight';

const idle = async (): Promise<void> => { await Promise.resolve(); };

const failing = async (): Promise<void> => { await Promise.resolve(); throw new Error('nope'); };

const noop = (): void => undefined;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = noop;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('inflight dedupe', () => {
  it('runs the work once while a request is running', async () => {
    let runs = 0;
    const gate = deferred();
    const first = once('k', async () => { runs += 1; await gate.promise; });
    const second = once('k', idle);
    expect(second).toBe(first);
    expect(latest('k')).toBe(first);
    gate.resolve();
    await first;
    expect(runs).toBe(1);
  });

  it('starts a new run after the previous one settled', async () => {
    const first = once('k2', idle);
    await first;
    const second = once('k2', idle);
    expect(second).not.toBe(first);
    await second;
  });
});

describe('inflight retention', () => {
  it('exposes the running promise and retains nothing after settle', async () => {
    const gate = deferred();
    const promise = once('k3', async () => { await gate.promise; });
    expect(latest('k3')).toBe(promise);
    gate.resolve();
    await promise;
    expect(latest('k3')).toBe(READY);
  });

  it('resolves a throwing run without rejecting', async () => {
    const promise = once('boom', failing);
    await expect(promise).resolves.toBeUndefined();
    expect(latest('boom')).toBe(READY);
  });

  it('keeps settled state bounded across many unique keys', async () => {
    const keys = Array.from({ length: 2000 }, (_, i) => `key-${String(i)}`);
    await Promise.all(keys.map((k) => once(k, idle)));
    for (const k of keys) { expect(latest(k)).toBe(READY); }
  });
});
