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

  it('reopens a closed connection so the next write lands', async () => {
    const { m, factory } = await fresh();
    const opened: IDBDatabase[] = [];
    const realOpen = factory.open.bind(factory);
    vi.spyOn(factory, 'open').mockImplementation((name: string, version?: number) => {
      const request = realOpen(name, version);
      request.addEventListener('success', () => { opened.push(request.result); });
      return request;
    });
    await m.idbSet('k', 1);
    opened[0].close();
    await expect(m.idbSet('k', 2)).rejects.toMatchObject({ name: 'StorageError', code: 'unavailable' });
    await expect(m.idbSet('k', 3)).resolves.toBeUndefined();
    await expect(m.idbGet('k')).resolves.toBe(3);
  });

  it('reopens a closed connection so the next read resolves', async () => {
    const { m, factory } = await fresh();
    const opened: IDBDatabase[] = [];
    const realOpen = factory.open.bind(factory);
    vi.spyOn(factory, 'open').mockImplementation((name: string, version?: number) => {
      const request = realOpen(name, version);
      request.addEventListener('success', () => { opened.push(request.result); });
      return request;
    });
    await m.idbSet('k', 1);
    opened[0].close();
    await expect(m.idbGet('k')).rejects.toMatchObject({ name: 'StorageError', code: 'unavailable' });
    await expect(m.idbGet('k')).resolves.toBe(1);
  });

  it('settles a hung write transaction with a typed timeout failure', async () => {
    const { m } = await fresh();
    await m.idbSet('k', 1);
    let registrations = 0;
    vi.spyOn(IDBTransaction.prototype, 'addEventListener').mockImplementation(() => { registrations += 1; });
    vi.useFakeTimers();
    try {
      const pending = m.idbSet('k', 2);
      const assertion = expect(pending).rejects.toMatchObject({ name: 'StorageError', code: 'transaction-aborted' });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(registrations).toBeGreaterThan(0);
      await assertion;
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
    await expect(m.idbSet('k', 3)).resolves.toBeUndefined();
    await expect(m.idbGet('k')).resolves.toBe(3);
  });
});

describe('response cache pruning', () => {
  it('prunes to the newest fresh records and reports the dropped count', async () => {
    const { m } = await fresh();
    const now = Date.now();
    await m.responsePut('expired', { fetchedAt: now - 1000, expiresAt: now - 500, body: { a: 1 } });
    await m.responsePut('older', { fetchedAt: now - 900, expiresAt: now + 5000, body: { b: 2 } });
    await m.responsePut('newer', { fetchedAt: now - 100, expiresAt: now + 5000, body: { c: 3 } });
    await expect(m.responsesPrune(now, 1)).resolves.toBe(2);
    await expect(m.responseGet('newer')).resolves.toMatchObject({ fetchedAt: now - 100 });
    await expect(m.responseGet('older')).resolves.toBeUndefined();
    await expect(m.responseGet('expired')).resolves.toBeUndefined();
  });

  it('drops every record when nothing is kept', async () => {
    const { m } = await fresh();
    const now = Date.now();
    await m.responsePut('one', { fetchedAt: now, expiresAt: now + 5000, body: { a: 1 } });
    await m.responsePut('two', { fetchedAt: now, expiresAt: now + 5000, body: { b: 2 } });
    await expect(m.responsesPrune(now, 0)).resolves.toBe(2);
    await expect(m.responseGet('one')).resolves.toBeUndefined();
    await expect(m.responseGet('two')).resolves.toBeUndefined();
  });
});
