import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as Idb from '../idb';

interface Fresh {
  m: typeof Idb;
  factory: IDBFactory;
}

async function fresh(): Promise<Fresh> {
  vi.resetModules();
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  return { m: await import('../idb'), factory };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('idb error semantics', () => {
  it('resolves undefined only for a genuinely missing key', async () => {
    const { m } = await fresh();
    await expect(m.idbGet('absent')).resolves.toBeUndefined();
    await expect(m.recordGet('absent')).resolves.toBeUndefined();
    await expect(m.recordsRange('p:', 'p:\uFFFF')).resolves.toEqual([]);
  });

  it('rejects every read when the database cannot open, and recovers on retry', async () => {
    const { m, factory } = await fresh();
    vi.spyOn(factory, 'open').mockImplementation((): IDBOpenDBRequest => {
      throw new DOMException('denied', 'SecurityError');
    });
    await expect(m.idbGet('any')).rejects.toMatchObject({ name: 'StorageError', code: 'open-failed' });
    await expect(m.recordsRange('p:', 'p:\uFFFF')).rejects.toMatchObject({ name: 'StorageError', code: 'open-failed' });
    vi.restoreAllMocks();
    await expect(m.idbGet('any')).resolves.toBeUndefined();
  });

  it('rejects a blocked upgrade with a typed error and reports it to the listener', async () => {
    const { m, factory } = await fresh();
    const blocked = vi.fn();
    m.onUpgradeBlocked(blocked);
    const blocker = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open('wl-storesv2', 1);
      request.addEventListener('success', () => { resolve(request.result); });
      request.addEventListener('error', () => { reject(new Error('blocker open failed')); });
    });
    await expect(m.idbSet('k', 1)).rejects.toMatchObject({ name: 'StorageError', code: 'blocked' });
    expect(blocked).toHaveBeenCalledWith(true);
    blocker.close();
  });

  it('rejects an aborted write transaction with a typed error and writes nothing', async () => {
    const { m } = await fresh();
    await expect(m.idbSet('k', () => 0)).rejects.toMatchObject({ name: 'StorageError' });
    await expect(m.idbGet('k')).resolves.toBeUndefined();
  });

  it('resolves a write only after the transaction completes', async () => {
    const { m } = await fresh();
    await m.idbSet('k', { v: 1 });
    await expect(m.idbGet('k')).resolves.toEqual({ v: 1 });
  });
});
