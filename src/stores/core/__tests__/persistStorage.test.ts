import { afterEach, describe, expect, it, vi } from 'vitest';

import { mergePreservingEdits } from '../persistStorage';

import type * as Idb from '../idb';
import type * as Ps from '../persistStorage';
import type { HydratablePersist } from '../types';

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

  it('reports a failed write through the fault listener', async () => {
    const { m, idb } = await fresh();
    const faults: string[] = [];
    m.onPersistFault((error) => { faults.push(error.code); });
    vi.mocked(idb.idbSet).mockRejectedValue(QUOTA);
    const storage = m.idbStorage<{ n: number }>();
    storage.setItem('app', VALUE);
    await vi.advanceTimersByTimeAsync(300);
    expect(faults).toEqual(['quota-exceeded']);
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

describe('hydration outcomes', () => {
  it('returns hydrated immediately when the store is already hydrated', async () => {
    const { m } = await fresh();
    let unsubs = 0;
    const bump = (): void => { unsubs += 1; };
    const store: HydratablePersist = {
      persist: { hasHydrated: () => true, onFinishHydration: () => bump },
    };
    await expect(m.waitForHydration(store)).resolves.toEqual({ status: 'hydrated' });
    expect(unsubs).toBe(0);
  });

  it('returns hydrated when rehydration finishes before the deadline', async () => {
    const { m } = await fresh();
    let finish: (() => void) | undefined;
    let unsubs = 0;
    let hydrated = false;
    const bump = (): void => { unsubs += 1; };
    const store: HydratablePersist = {
      persist: {
        hasHydrated: () => hydrated,
        onFinishHydration: (fn) => { finish = fn; return bump; },
      },
    };
    const result = m.waitForHydration(store, 3000);
    hydrated = true;
    finish?.();
    await expect(result).resolves.toEqual({ status: 'hydrated' });
    expect(unsubs).toBe(1);
  });

  it('clears the deadline timer when rehydration finishes', async () => {
    const { m } = await fresh();
    let finish: (() => void) | undefined;
    let unsubs = 0;
    let hydrated = false;
    const bump = (): void => { unsubs += 1; };
    const store: HydratablePersist = {
      persist: {
        hasHydrated: () => hydrated,
        onFinishHydration: (fn) => { finish = fn; return bump; },
      },
    };
    const result = m.waitForHydration(store, 3000);
    hydrated = true;
    finish?.();
    await expect(result).resolves.toEqual({ status: 'hydrated' });
    expect(vi.getTimerCount()).toBe(0);
    expect(unsubs).toBe(1);
  });

  it('returns timeout and removes the subscription when rehydration does not finish', async () => {
    const { m } = await fresh();
    let unsubs = 0;
    const bump = (): void => { unsubs += 1; };
    const store: HydratablePersist = {
      persist: { hasHydrated: () => false, onFinishHydration: () => bump },
    };
    const result = m.waitForHydration(store, 3000);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toEqual({ status: 'timeout' });
    expect(unsubs).toBe(1);
  });

  it('records a failed hydration read and clears it after a successful read', async () => {
    const { m, idb } = await fresh();
    vi.mocked(idb.idbGet).mockRejectedValueOnce(new DOMException('gone', 'AbortError'));
    const storage = m.idbStorage<{ n: number }>();
    await expect(storage.getItem('app')).rejects.toMatchObject({ name: 'AbortError' });
    expect(m.hydrationError('app')).not.toBeNull();
    vi.mocked(idb.idbGet).mockResolvedValue(null);
    await storage.getItem('app');
    expect(m.hydrationError('app')).toBeNull();
  });

  it('preserves the error the persist middleware reports and clears it on success', async () => {
    const { m } = await fresh();
    const track = m.trackRehydration('app');
    track({ n: 1 })({ n: 1 }, new DOMException('corrupt', 'DataError'));
    expect(m.hydrationError('app')).not.toBeNull();
    track({ n: 1 })({ n: 1 });
    expect(m.hydrationError('app')).toBeNull();
  });
});

describe('mergePreservingEdits', () => {
  it('applies the persisted state while the current state is untouched', () => {
    const merge = mergePreservingEdits<{ cityIds: string[] }>({ cityIds: [] });
    expect(merge({ cityIds: ['a'] }, { cityIds: [] })).toEqual({ cityIds: ['a'] });
  });

  it('keeps the current state once it has been edited', () => {
    const merge = mergePreservingEdits<{ cityIds: string[] }>({ cityIds: [] });
    expect(merge({ cityIds: ['a'] }, { cityIds: ['b'] })).toEqual({ cityIds: ['b'] });
  });

  it('keeps the current state when the persisted value is not an object', () => {
    const merge = mergePreservingEdits<{ cityIds: string[] }>({ cityIds: [] });
    expect(merge(null, { cityIds: [] })).toEqual({ cityIds: [] });
  });
});
