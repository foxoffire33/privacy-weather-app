import { describe, expect, it } from 'vitest';

import { useDiagnosticsStore } from '../diagnosticsStore';

import type { DiagnosticEntry } from '../storeTypes';

const entry = (name: string): DiagnosticEntry => ({ kind: 'measure', name, at: 0, duration: 1, blocking: 0, detail: '', route: '/' });

describe('diagnosticsStore', () => {
  it('counts metrics per key and resets them with the entries on clear', () => {
    const store = useDiagnosticsStore;
    store.getState().clear();
    store.getState().bump('loads');
    store.getState().bump('loads');
    store.getState().bump('cacheHits');
    expect(store.getState().metrics).toEqual({ loads: 2, cacheHits: 1, recordFlushes: 0, recordFlushFailures: 0, kvFlushes: 0, kvFlushFailures: 0, hydrationFailures: 0 });
    store.getState().add(entry('a'));
    store.getState().clear();
    expect(store.getState().entries).toEqual([]);
    expect(store.getState().metrics).toEqual({ loads: 0, cacheHits: 0, recordFlushes: 0, recordFlushFailures: 0, kvFlushes: 0, kvFlushFailures: 0, hydrationFailures: 0 });
  });

  it('keeps at most 200 entries, dropping the oldest', () => {
    const store = useDiagnosticsStore;
    store.getState().clear();
    for (let i = 0; i < 205; i += 1) { store.getState().add(entry(`e${String(i)}`)); }
    const { entries } = store.getState();
    expect(entries).toHaveLength(200);
    expect(entries[0].name).toBe('e5');
    expect(entries.at(-1)?.name).toBe('e204');
    expect(entries.map((e) => e.name)).toEqual(Array.from({ length: 200 }, (_, i) => `e${String(i + 5)}`));
  });
});
