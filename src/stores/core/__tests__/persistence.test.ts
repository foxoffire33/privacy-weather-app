import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as Idbs from '../idb';
import type * as Persistence from '../persistence';

interface Modules {
  p: typeof Persistence;
  idb: typeof Idbs;
}

async function fresh(): Promise<Modules> {
  vi.resetModules();
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  const [p, idb] = await Promise.all([import('../persistence'), import('../idb')]);
  return { p, idb };
}

afterEach(() => { vi.unstubAllGlobals(); });

function stubEstimate(result: unknown): void {
  vi.stubGlobal('navigator', { storage: { estimate: vi.fn().mockResolvedValue(result) } });
}

describe('storage estimate', () => {
  it('flags low headroom', async () => {
    stubEstimate({ quota: 100_000_000, usage: 99_995_000 });
    const { p } = await fresh();
    await expect(p.estimateStorage()).resolves.toEqual({ quota: 100_000_000, usage: 99_995_000, headroom: 5000, low: true });
  });

  it('reports ample headroom as not low', async () => {
    stubEstimate({ quota: 1_000_000_000, usage: 10_000_000 });
    const { p } = await fresh();
    await expect(p.estimateStorage()).resolves.toEqual({ quota: 1_000_000_000, usage: 10_000_000, headroom: 990_000_000, low: false });
  });

  it('does not warn when the quota is unknown', async () => {
    stubEstimate({});
    const { p } = await fresh();
    await expect(p.estimateStorage()).resolves.toEqual({ quota: 0, usage: 0, headroom: 0, low: false });
  });

  it('resolves null when the estimate rejects', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: vi.fn().mockRejectedValue(new Error('denied')) } });
    const { p } = await fresh();
    await expect(p.estimateStorage()).resolves.toBeNull();
  });

  it('resolves null when the estimate throws synchronously', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: () => { throw new Error('unavailable'); } } });
    const { p } = await fresh();
    await expect(p.estimateStorage()).resolves.toBeNull();
  });

  it('resolves null where navigator storage is unavailable', async () => {
    const { p } = await fresh();
    await expect(p.estimateStorage()).resolves.toBeNull();
  });
});

describe('clearResponseCache', () => {
  it('drops every response record and reports the count', async () => {
    const { p, idb } = await fresh();
    const now = Date.now();
    await idb.responsePut('one', { fetchedAt: now, expiresAt: now + 5000, body: { a: 1 } });
    await idb.responsePut('two', { fetchedAt: now, expiresAt: now + 5000, body: { b: 2 } });
    await expect(p.clearResponseCache()).resolves.toBe(2);
    await expect(idb.responseGet('one')).resolves.toBeUndefined();
    await expect(idb.responseGet('two')).resolves.toBeUndefined();
  });
});
