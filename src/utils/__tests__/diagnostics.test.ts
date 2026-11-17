import { describe, expect, it } from 'vitest';

import { diagnosticsReport } from '../diagnostics';

import type { DiagnosticEntry, DiagnosticMetrics } from '../../stores';
import type { StorageEstimate } from '../../stores/core/persistence';

const METRICS: DiagnosticMetrics = { loads: 3, cacheHits: 1, recordFlushes: 2, recordFlushFailures: 1, kvFlushes: 1, kvFlushFailures: 0, hydrationFailures: 0 };

const ENTRY: DiagnosticEntry = { kind: 'failure', name: 'record-flush', at: 12.4, duration: 0, blocking: 0, detail: 'quota-exceeded', route: '/' };

describe('diagnosticsReport', () => {
  it('lists entries, the metric counters, and the storage estimate', () => {
    const storage: StorageEstimate = { quota: 10 * 1e6, usage: 2 * 1e6, headroom: 8 * 1e6, low: false };
    const lines = diagnosticsReport([ENTRY], 'TestAgent', METRICS, storage).split('\n');
    expect(lines[0]).toBe('Weather Log diagnostics · TestAgent');
    expect(lines).toContain('failure\trecord-flush\tquota-exceeded\t12\t0\t0\t/');
    expect(lines).toContain('metrics\tloads\t3');
    expect(lines).toContain('metrics\trecordFlushFailures\t1');
    expect(lines).toContain('metrics\thydrationFailures\t0');
    expect(lines).toContain('storage\t2\t10\tno');
  });

  it('marks unknown storage and an empty entry list', () => {
    const lines = diagnosticsReport([], 'TestAgent', METRICS, null).split('\n');
    expect(lines).toHaveLength(2 + 7 + 1);
    expect(lines).toContain('storage\tunknown\tunknown\tno');
  });
});
