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

async function tick(): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, 0); });
}

function heldGate(): { promise: Promise<void>; release: () => void } {
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release: () => { release?.(); } };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('clearRecords ordering contract', () => {
  it('drops a pending put submitted before the clear', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
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
    const clearing = m.clearRecords('p:');
    await tick();
    m.putRecord('p:y', 2);
    await clearing;
    await m.flushRecords();
    expect(log).toEqual(['delete p:', 'write']);
    expect(idb.recordsWrite).toHaveBeenCalledWith([['p:y', 2]], []);
  });

  it('rejects a failed clear with a typed error and leaves the chain usable', async () => {
    const log: string[] = [];
    const { m, idb } = await fresh(log);
    vi.mocked(idb.recordsDeletePrefix).mockImplementationOnce(() => {
      log.push('delete failed');
      throw new DOMException('full', 'QuotaExceededError');
    });
    await expect(m.clearRecords('p:')).rejects.toMatchObject({ name: 'StorageError', code: 'quota-exceeded' });
    m.putRecord('p:z', 3);
    await m.flushRecords();
    expect(idb.recordsWrite).toHaveBeenCalledWith([['p:z', 3]], []);
    expect(log).toEqual(['delete failed', 'write']);
  });

  it('serializes multiple prefix clears without interference', async () => {
    const log: string[] = [];
    const { m } = await fresh(log);
    const first = m.clearRecords('a:');
    const second = m.clearRecords('b:');
    await Promise.all([first, second]);
    expect(log).toEqual(['delete a:', 'delete b:']);
  });
});
