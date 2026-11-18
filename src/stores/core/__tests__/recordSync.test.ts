import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as Idb from '../idb';
import type * as Rsync from '../recordSync';

vi.mock('../idb', async (importOriginal) => {
  const actual = await importOriginal<typeof Idb>();
  return { ...actual, recordsWrite: vi.fn(), recordsDeletePrefix: vi.fn() };
});

interface Fresh {
  m: typeof Rsync;
  idb: typeof Idb;
}

async function fresh(log: string[]): Promise<Fresh> {
  vi.resetModules();
  const [m, idb] = await Promise.all([import('../recordSync'), import('../idb')]);
  vi.mocked(idb.recordsWrite).mockImplementation(async () => { log.push('write'); await Promise.resolve(); });
  vi.mocked(idb.recordsDeletePrefix).mockImplementation(async (prefix) => { log.push(`delete ${prefix}`); await Promise.resolve(); });
  return { m, idb };
}

const busy = () => { throw new DOMException('busy', 'AbortError'); };

function heldGate(): { promise: Promise<void>; release: () => void } {
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release: () => { release?.(); } };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('clearRecords ordering contract', () => {
  it('drops a pending put submitted before the clear', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    m.putRecord('p:x', 1);
    await m.clearRecords('p:');
    await m.flushRecords();
    expect(idb.recordsDeletePrefix).toHaveBeenCalledWith('p:');
    expect(idb.recordsWrite).not.toHaveBeenCalled();
    expect(log).toEqual(['delete p:']);
  });

  it('commits the clear after an in-flight flush, so the cleared key does not resurrect', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    const gate = heldGate();
    vi.mocked(idb.recordsWrite).mockImplementationOnce(async () => {
      log.push('write');
      await gate.promise;
    });
    m.putRecord('p:x', 1);
    const flushing = m.flushRecords();
    await vi.waitFor(() => { expect(vi.mocked(idb.recordsWrite)).toHaveBeenCalledTimes(1); });
    const clearing = m.clearRecords('p:');
    gate.release();
    await flushing;
    await clearing;
    expect(log).toEqual(['write', 'delete p:']);
  });

  it('lets a put submitted after the clear persist once the clear completes', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    const clearing = m.clearRecords('p:');
    m.putRecord('p:y', 2);
    await clearing;
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(['delete p:', 'write']);
    expect(idb.recordsWrite).toHaveBeenCalledWith([['p:y', 2]], []);
  });

  it('keeps a post-clear put safe across a failed clear retry', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    vi.mocked(idb.recordsDeletePrefix).mockImplementationOnce(() => {
      log.push('delete failed');
      throw new DOMException('full', 'QuotaExceededError');
    });
    const clearing = m.clearRecords('p:');
    const rejected = expect(clearing).rejects.toMatchObject({ name: 'StorageError', code: 'quota-exceeded' });
    m.putRecord('p:z', 3);
    await vi.advanceTimersByTimeAsync(0);
    await rejected;
    expect(m.recordSyncStatus().pending).toBe(1);
    expect(idb.recordsWrite).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(0);
    expect(idb.recordsWrite).toHaveBeenCalledWith([['p:z', 3]], []);
    expect(m.recordSyncStatus().pending).toBe(0);
    expect(log).toEqual(['delete failed', 'delete p:', 'write']);
  });

  it('retries an exhausted clear on a manual flush, ordered before the queued write', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    vi.mocked(idb.recordsDeletePrefix).mockImplementation(() => {
      log.push('delete failed');
      throw new DOMException('full', 'QuotaExceededError');
    });
    const clearing = m.clearRecords('p:');
    const rejected = expect(clearing).rejects.toMatchObject({ name: 'StorageError', code: 'quota-exceeded' });
    m.putRecord('p:y', 1);
    await vi.advanceTimersByTimeAsync(0);
    await rejected;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(log.filter((entry) => entry === 'delete failed')).toHaveLength(9);
    vi.mocked(idb.recordsDeletePrefix).mockImplementation(async (prefix) => { log.push(`delete ${prefix}`); });
    await m.flushRecords();
    expect(m.recordSyncStatus().pending).toBe(0);
    expect(idb.recordsWrite).toHaveBeenCalledWith([['p:y', 1]], []);
    expect(log).toContain('delete p:');
  });

  it('serializes multiple prefix clears without interference', async () => {
    const log: string[] = [];
    const { m } = await fresh(log);
    vi.useFakeTimers();
    const first = m.clearRecords('a:');
    const second = m.clearRecords('b:');
    await Promise.all([first, second]);
    expect(log).toEqual(['delete a:', 'delete b:']);
  });
});

describe('record flush retry policy', () => {
  it('rejects when its batch fails and exposes the failure in the status', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    vi.mocked(idb.recordsWrite).mockImplementationOnce(() => {
      log.push('write failed');
      throw new DOMException('full', 'QuotaExceededError');
    });
    m.putRecord('p:x', 1);
    await expect(m.flushRecords()).rejects.toMatchObject({ name: 'StorageError', code: 'quota-exceeded' });
    const status = m.recordSyncStatus();
    expect(status.pending).toBe(1);
    expect(status.code).toBe('quota-exceeded');
    expect(status.lastError).toBe('IndexedDB write failed: full');
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.mocked(idb.recordsWrite)).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures on bounded backoff and recovers', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    vi.mocked(idb.recordsWrite)
      .mockImplementationOnce(busy)
      .mockImplementationOnce(busy)
      .mockImplementationOnce(async () => { log.push('write'); await Promise.resolve(); });
    m.putRecord('p:x', 1);
    await expect(m.flushRecords()).rejects.toMatchObject({ name: 'StorageError', code: 'transaction-aborted' });
    expect(m.recordSyncStatus().pending).toBe(1);
    expect(m.recordSyncStatus().attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(vi.mocked(idb.recordsWrite)).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(vi.mocked(idb.recordsWrite)).toHaveBeenCalledTimes(3);
    const healed = m.recordSyncStatus();
    expect(healed.pending).toBe(0);
    expect(healed.attempts).toBe(0);
    expect(healed.lastError).toBeNull();
  });

  it('exhausts the auto-retry budget on a quota failure and recovers on a manual flush', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    vi.mocked(idb.recordsWrite).mockImplementation(() => {
      log.push('write failed');
      throw new DOMException('full', 'QuotaExceededError');
    });
    m.putRecord('p:x', 1);
    await expect(m.flushRecords()).rejects.toMatchObject({ name: 'StorageError', code: 'quota-exceeded' });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(vi.mocked(idb.recordsWrite)).toHaveBeenCalledTimes(9);
    expect(m.recordSyncStatus().pending).toBe(1);
    vi.mocked(idb.recordsWrite).mockImplementation(async () => { log.push('write'); await Promise.resolve(); });
    await m.flushRecords();
    expect(m.recordSyncStatus().pending).toBe(0);
    expect(vi.mocked(idb.recordsWrite)).toHaveBeenCalledTimes(10);
  });

  it('lets a newer write win after a failure and resets the retry budget', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    vi.mocked(idb.recordsWrite).mockImplementationOnce(() => {
      log.push('write failed');
      throw new DOMException('busy', 'AbortError');
    });
    m.putRecord('p:x', 1);
    await expect(m.flushRecords()).rejects.toMatchObject({ name: 'StorageError', code: 'transaction-aborted' });
    m.putRecord('p:x', 2);
    await vi.advanceTimersByTimeAsync(300);
    expect(vi.mocked(idb.recordsWrite)).toHaveBeenLastCalledWith([['p:x', 2]], []);
    expect(m.recordSyncStatus().pending).toBe(0);
    expect(m.recordSyncStatus().lastError).toBeNull();
  });
});

describe('change bookkeeping', () => {
  it('records nothing while tracking is off', async () => {
    const { m } = await fresh([]);
    vi.useFakeTimers();
    m.putRecord('p:x', 1);
    m.deleteRecord('p:y');
    await m.clearRecords('q:');
    await m.flushRecords();
    expect(m.changedSinceStart('p:x')).toBe(false);
    expect(m.changedSinceStart('p:y')).toBe(false);
    expect(m.changedSinceStart('q:z')).toBe(false);
  });

  it('records puts, deletes and cleared prefixes while tracking', async () => {
    const { m } = await fresh([]);
    vi.useFakeTimers();
    m.trackChanges(true);
    m.putRecord('p:x', 1);
    m.deleteRecord('p:y');
    await m.clearRecords('q:');
    expect(m.changedSinceStart('p:x')).toBe(true);
    expect(m.changedSinceStart('p:y')).toBe(true);
    expect(m.changedSinceStart('q:z')).toBe(true);
    expect(m.changedSinceStart('p:other')).toBe(false);
  });

  it('forgets the bookkeeping when tracking ends', async () => {
    const { m } = await fresh([]);
    vi.useFakeTimers();
    m.trackChanges(true);
    m.putRecord('p:x', 1);
    await m.clearRecords('q:');
    m.trackChanges(false);
    expect(m.changedSinceStart('p:x')).toBe(false);
    expect(m.changedSinceStart('q:z')).toBe(false);
  });

  it('does not record restores even while tracking', async () => {
    const { m } = await fresh([]);
    vi.useFakeTimers();
    m.trackChanges(true);
    m.restore(() => { m.putRecord('p:x', 1); });
    m.restore(() => { m.deleteRecord('p:y'); });
    expect(m.changedSinceStart('p:x')).toBe(false);
    expect(m.changedSinceStart('p:y')).toBe(false);
  });

  it('prunes clear markers once the clears settle and tracking is off', async () => {
    const { m } = await fresh([]);
    vi.useFakeTimers();
    await m.clearRecords('a:');
    await m.clearRecords('b:');
    expect(m.changedSinceStart('a:x')).toBe(false);
    expect(m.changedSinceStart('b:y')).toBe(false);
  });

  it('keeps clear markers while tracking is on, and drops them when tracking ends', async () => {
    const { m } = await fresh([]);
    vi.useFakeTimers();
    m.trackChanges(true);
    await m.clearRecords('a:');
    expect(m.changedSinceStart('a:x')).toBe(true);
    m.trackChanges(false);
    expect(m.changedSinceStart('a:x')).toBe(false);
  });

  it('drops a requeued put covered by a clear that landed after the failed flush', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.useFakeTimers();
    vi.mocked(idb.recordsWrite).mockImplementationOnce(busy);
    m.putRecord('p:x', 1);
    const failing = m.flushRecords();
    const rejected = expect(failing).rejects.toMatchObject({ name: 'StorageError', code: 'transaction-aborted' });
    await vi.waitFor(() => { expect(vi.mocked(idb.recordsWrite)).toHaveBeenCalledTimes(1); });
    await m.clearRecords('p:');
    await rejected;
    expect(m.recordSyncStatus().pending).toBe(0);
    await m.flushRecords();
    expect(idb.recordsWrite).toHaveBeenCalledTimes(1);
  });
});