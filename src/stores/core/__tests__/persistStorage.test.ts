import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as Idb from '../idb';
import type * as Ps from '../persistStorage';

vi.mock('../idb', async (importOriginal) => {
  const actual = await importOriginal<typeof Idb>();
  return { ...actual, idbSet: vi.fn(), idbGet: vi.fn(), idbDel: vi.fn() };
});

const VALUE = { state: { n: 1 }, version: 1 };
const QUOTA = new DOMException('full', 'QuotaExceededError');

interface Fresh {
  m: typeof Ps;
  idb: typeof Idb;
}

async function fresh(): Promise<Fresh> {
  vi.resetModules();
  vi.useFakeTimers();
  const [m, idb] = await Promise.all([import('../persistStorage'), import('../idb')]);
  return { m, idb };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('persistStorage write coordinator', () => {
  it('keeps a quota-failed write queued, exposes the error, and recovers through the manual retry', async () => {
    const { m, idb } = await fresh();
    vi.mocked(idb.idbSet).mockRejectedValue(QUOTA);
    const storage = m.idbStorage<{ n: number }>();
    storage.setItem('app', VALUE);
    await vi.advanceTimersByTimeAsync(300);
    const failed = m.persistenceStatus('app');
    expect(failed.pending).toBe(true);
    expect(failed.code).toBe('quota-exceeded');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(vi.mocked(idb.idbSet)).toHaveBeenCalledTimes(1);
    vi.mocked(idb.idbSet).mockResolvedValue();
    m.retryPersistedState('app');
    await m.flushPersistedState('app');
    const healed = m.persistenceStatus('app');
    expect(healed.pending).toBe(false);
    expect(healed.lastError).toBeNull();
    expect(vi.mocked(idb.idbSet)).toHaveBeenLastCalledWith('app', VALUE);
  });

  it('rejects flushPersistedState while a write cannot complete', async () => {
    const { m, idb } = await fresh();
    vi.mocked(idb.idbSet).mockRejectedValue(QUOTA);
    const storage = m.idbStorage<{ n: number }>();
    storage.setItem('app', VALUE);
    await expect(m.flushPersistedState('app')).rejects.toMatchObject({ name: 'StorageError', code: 'quota-exceeded' });
  });

  it('retries transient failures with bounded backoff until recovery', async () => {
    const { m, idb } = await fresh();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const aborted = new DOMException('busy', 'AbortError');
    vi.mocked(idb.idbSet).mockRejectedValueOnce(aborted).mockRejectedValueOnce(aborted).mockResolvedValue();
    const storage = m.idbStorage<{ n: number }>();
    storage.setItem('app', VALUE);
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(500);
    expect(vi.mocked(idb.idbSet)).toHaveBeenCalledTimes(3);
    const healed = m.persistenceStatus('app');
    expect(healed.pending).toBe(false);
    expect(healed.lastError).toBeNull();
  });

  it('lets the newest value win when writes overlap', async () => {
    const { m, idb } = await fresh();
    vi.mocked(idb.idbSet).mockResolvedValue();
    const storage = m.idbStorage<{ n: number }>();
    storage.setItem('app', { state: { n: 1 }, version: 1 });
    await vi.advanceTimersByTimeAsync(100);
    storage.setItem('app', { state: { n: 2 }, version: 1 });
    await vi.advanceTimersByTimeAsync(300);
    expect(vi.mocked(idb.idbSet)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(idb.idbSet)).toHaveBeenCalledWith('app', { state: { n: 2 }, version: 1 });
  });

  it('gates writes for a key whose hydration read failed, and resumes after a successful read', async () => {
    const { m, idb } = await fresh();
    vi.mocked(idb.idbGet).mockRejectedValueOnce(new DOMException('gone', 'AbortError'));
    const storage = m.idbStorage<{ n: number }>();
    await expect(storage.getItem('app')).rejects.toMatchObject({ name: 'AbortError' });
    vi.mocked(idb.idbSet).mockResolvedValue();
    storage.setItem('app', VALUE);
    await vi.advanceTimersByTimeAsync(500);
    expect(vi.mocked(idb.idbSet)).not.toHaveBeenCalled();
    vi.mocked(idb.idbGet).mockResolvedValue(null);
    await storage.getItem('app');
    await vi.advanceTimersByTimeAsync(500);
    expect(vi.mocked(idb.idbSet)).toHaveBeenCalledTimes(1);
    expect(m.persistenceStatus('app').pending).toBe(false);
  });
});
