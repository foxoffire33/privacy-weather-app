import { onMeasure } from '../stores/core/marks';
import { useDiagnosticsStore } from '../stores/diagnosticsStore';

import type { DiagnosticEntry, DiagnosticMetrics } from '../stores';
import type { StorageEstimate } from '../stores/core/persistence';
import type { RouteVisit } from '../types';

const KEEP_ROUTES = 100;
const visits: RouteVisit[] = [];

function currentRoute(): string {
  if (typeof location === 'undefined') { return ''; }
  const hash = location.hash.replace(/^#/, '').split('?', 1)[0] ?? '';
  return hash === '' ? '/' : hash;
}

export function noteRoute(route: string): void {
  if (visits.at(-1)?.route === route) { return; }
  visits.push({ at: performance.now(), route });
  if (visits.length > KEEP_ROUTES) { visits.shift(); }
}

export function noteFailure(name: string, detail: string): void {
  record({ kind: 'failure', name, detail, at: performance.now(), duration: 0, blocking: 0 });
}

function routeAt(at: number): string {
  return visits.findLast((v) => v.at <= at)?.route ?? visits.at(0)?.route ?? currentRoute();
}

function record(entry: Omit<DiagnosticEntry, 'route'>): void {
  useDiagnosticsStore.getState().add({ ...entry, route: routeAt(entry.at) });
}

function frameName(entry: PerformanceEntry): string {
  const scripts: unknown = Reflect.get(entry, 'scripts');
  if (!Array.isArray(scripts)) { return entry.entryType; }
  const top: unknown = scripts.at(0);
  if (typeof top !== 'object' || top === null) { return entry.entryType; }
  const fn: unknown = Reflect.get(top, 'sourceFunctionName');
  const invoker: unknown = Reflect.get(top, 'invoker');
  const name = [fn, invoker].filter((v): v is string => typeof v === 'string' && v !== '').join(' · ');
  return name === '' ? entry.entryType : name;
}

export function startDiagnostics(): void {
  if (visits.length === 0) { visits.push({ at: 0, route: currentRoute() }); }
  onMeasure((name, at, duration) => { record({ kind: 'measure', name, at, duration, blocking: 0, detail: '' }); });
  if (typeof PerformanceObserver === 'undefined') { return; }
  const types = PerformanceObserver.supportedEntryTypes;
  const type = types.includes('long-animation-frame') ? 'long-animation-frame' : 'longtask';
  if (!types.includes(type)) { return; }
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const blocking: unknown = Reflect.get(entry, 'blockingDuration');
      record({ kind: 'frame', name: frameName(entry), at: entry.startTime, duration: entry.duration, blocking: typeof blocking === 'number' ? blocking : 0, detail: '' });
    }
  });
  observer.observe({ type, buffered: true });
}

const mb = (bytes: number): number => Math.round((bytes / 1e6) * 10) / 10;

export function diagnosticsReport(entries: readonly DiagnosticEntry[], userAgent: string, metrics: DiagnosticMetrics, storage: StorageEstimate | null): string {
  const lines = entries.map((e) => [e.kind, e.name, e.detail, Math.round(e.at), Math.round(e.duration), Math.round(e.blocking), e.route].join('\t'));
  const metricLines = [
    `metrics\tloads\t${String(metrics.loads)}`,
    `metrics\tcacheHits\t${String(metrics.cacheHits)}`,
    `metrics\trecordFlushes\t${String(metrics.recordFlushes)}`,
    `metrics\trecordFlushFailures\t${String(metrics.recordFlushFailures)}`,
    `metrics\tkvFlushes\t${String(metrics.kvFlushes)}`,
    `metrics\tkvFlushFailures\t${String(metrics.kvFlushFailures)}`,
    `metrics\thydrationFailures\t${String(metrics.hydrationFailures)}`,
  ];
  const storageLine = storage === null
    ? 'storage\tunknown\tunknown\tno'
    : `storage\t${String(mb(storage.usage))}\t${String(mb(storage.quota))}\t${storage.low ? 'yes' : 'no'}`;
  return [`Weather Log diagnostics · ${userAgent}`, 'kind\tname\tdetail\tat ms\tduration ms\tblocking ms\troute', ...lines, ...metricLines, storageLine].join('\n');
}
