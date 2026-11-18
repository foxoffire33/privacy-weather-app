import { useDiagnosticsStore } from '../diagnosticsStore';

import { errorMessage } from './errors';
import { recordGet, recordsDeletePrefix, recordsRange, recordsWrite, RETRYABLE_WRITE_CODES, toStorageError } from './idb';
import { measure } from './marks';

import type { StorageError, StorageErrorCode } from './idb';
import type { IdbEntry, MapStore } from './types';

const FLUSH_MS = 250;
const RETRY_BASE_MS = 250;
const RETRY_MAX_MS = 30_000;
const MAX_AUTO_RETRIES = 8;

const puts = new Map<string, unknown>();
const putGen = new Map<string, number>();
const deletes = new Set<string>();
const deleteGen = new Map<string, number>();
let counter = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let restoring = 0;

interface ClearOp {
  prefix: string;
  boundary: number;
  attempts: number;
  exhausted: boolean;
}

let chain: Promise<void> = Promise.resolve();
const pendingClears: ClearOp[] = [];
const cleared: { prefix: string; seq: number }[] = [];
let clearSeq = 0;
let inFlightMark: number | null = null;
const touched = new Set<string>();
let tracking = false;

let attempts = 0;
let lastError: StorageError | null = null;
let faultListener: ((error: StorageError) => void) | null = null;
let recoveredListener: (() => void) | null = null;

export function onRecordFault(listener: ((error: StorageError) => void) | null): void {
  faultListener = listener;
}

export function onRecordRecovered(listener: (() => void) | null): void {
  recoveredListener = listener;
}

export interface RecordSyncStatus {
  pending: number;
  attempts: number;
  code: StorageErrorCode | null;
  lastError: string | null;
}

export function recordSyncStatus(): RecordSyncStatus {
  return {
    pending: puts.size + deletes.size,
    attempts,
    code: lastError === null ? null : lastError.code,
    lastError: lastError === null ? null : errorMessage(lastError),
  };
}

function backoffDelay(count: number): number {
  const base = Math.min(RETRY_BASE_MS * 2 ** (count - 1), RETRY_MAX_MS);
  return base * (0.5 + Math.random() * 0.5);
}

function reportFault(error: StorageError): void {
  faultListener?.(error);
}

function pruneCleared(): void {
  if (tracking) { return; }
  if (inFlightMark === null) { cleared.length = 0; return; }
  while (cleared.length > 0 && cleared[0].seq < inFlightMark) { cleared.shift(); }
}

function purgeFor(op: ClearOp): void {
  for (const key of [...puts.keys()]) {
    if (key.startsWith(op.prefix) && (putGen.get(key) ?? 0) < op.boundary) { puts.delete(key); putGen.delete(key); }
  }
  for (const key of [...deletes]) {
    if (key.startsWith(op.prefix) && (deleteGen.get(key) ?? 0) < op.boundary) { deletes.delete(key); deleteGen.delete(key); }
  }
}

function settleIfIdle(): void {
  if (puts.size === 0 && deletes.size === 0 && lastError !== null) {
    lastError = null;
    recoveredListener?.();
  }
}

function requeue(batch: readonly IdbEntry[], gone: readonly string[], sinceSeq: number): void {
  const clearedSince = cleared.filter((e) => e.seq >= sinceSeq).map((e) => e.prefix);
  const keep = (key: string): boolean =>
    !puts.has(key) && !deletes.has(key) && !clearedSince.some((prefix) => key.startsWith(prefix));
  for (const [key, value] of batch) { if (keep(key)) { puts.set(key, value); } }
  for (const key of gone) { if (keep(key)) { deletes.add(key); } }
}

function blockedByPendingClear(key: string): boolean {
  return pendingClears.some((op) => key.startsWith(op.prefix));
}

async function flushOnce(): Promise<StorageError | null> {
  const batch: IdbEntry[] = [...puts].filter(([key]) => !blockedByPendingClear(key));
  const gone = [...deletes].filter((key) => !blockedByPendingClear(key));
  if (batch.length === 0 && gone.length === 0) {
    settleIfIdle();
    return null;
  }
  const clearMark = clearSeq;
  inFlightMark = clearMark;
  for (const [key] of batch) { puts.delete(key); }
  for (const key of gone) { deletes.delete(key); }
  try {
    await measure('persist-flush', async () => { recordsWrite(batch, gone); });
    for (const [key] of batch) { putGen.delete(key); }
    for (const key of gone) { deleteGen.delete(key); }
    attempts = 0;
    lastError = null;
    useDiagnosticsStore.getState().bump('recordFlushes');
    recoveredListener?.();
    return null;
  } catch (error) {
    const storageError = toStorageError('write', error);
    requeue(batch, gone, clearMark);
    lastError = storageError;
    if (RETRYABLE_WRITE_CODES.has(storageError.code) && attempts < MAX_AUTO_RETRIES) {
      attempts += 1;
      timer ??= setTimeout(() => { timer = null; void flushRecords().catch(() => null); }, backoffDelay(attempts));
    }
    return storageError;
  } finally {
    inFlightMark = null;
    pruneCleared();
  }
}

function enqueueClear(op: ClearOp): void {
  chain = chain.then(
    async () => { await runClear(op).catch(() => null); },
    async () => { await runClear(op).catch(() => null); },
  );
}

function retryExhaustedClears(): void {
  for (const op of pendingClears) {
    if (!op.exhausted) { continue; }
    op.exhausted = false;
    op.attempts = 0;
    enqueueClear(op);
  }
}

export async function flushRecords(): Promise<void> {
  if (timer !== null) { clearTimeout(timer); }
  timer = null;
  retryExhaustedClears();
  let outcome: StorageError | null;
  chain = chain.then(
    async () => { outcome = await flushOnce(); },
    async () => { outcome = await flushOnce(); },
  );
  return chain.then(() => {
    if (outcome !== null) {
      reportFault(outcome);
      throw outcome;
    }
  });
}

function schedule(): void {
  attempts = 0;
  timer ??= setTimeout(() => { timer = null; void flushRecords().catch(() => null); }, FLUSH_MS);
}

if (typeof document !== 'undefined') {
  document.addEventListener('pagehide', () => { void flushRecords().catch(() => null); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { void flushRecords().catch(() => null); } });
}

export function trackChanges(on: boolean): void {
  tracking = on;
  if (!on) {
    touched.clear();
    pruneCleared();
  }
}

export function changedSinceStart(key: string): boolean {
  return touched.has(key) || cleared.some((e) => key.startsWith(e.prefix));
}

export function putRecord(key: string, value: unknown): void {
  if (restoring > 0) { return; }
  if (tracking) { touched.add(key); }
  deletes.delete(key);
  deleteGen.delete(key);
  puts.set(key, value);
  putGen.set(key, counter);
  counter += 1;
  schedule();
}

export function deleteRecord(key: string): void {
  if (restoring > 0) { return; }
  if (tracking) { touched.add(key); }
  puts.delete(key);
  putGen.delete(key);
  deletes.add(key);
  deleteGen.set(key, counter);
  counter += 1;
  schedule();
}

export function clearRecords(prefix: string): Promise<void> {
  const op: ClearOp = { prefix, boundary: counter, attempts: 0, exhausted: false };
  pendingClears.push(op);
  cleared.push({ prefix, seq: clearSeq });
  clearSeq += 1;
  const step = chain.then(() => runClear(op), () => runClear(op));
  chain = step;
  return step;
}

async function runClear(op: ClearOp): Promise<void> {
  try {
    await recordsDeletePrefix(op.prefix);
  } catch (error) {
    const storageError = toStorageError('write', error);
    lastError = storageError;
    reportFault(storageError);
    if (RETRYABLE_WRITE_CODES.has(storageError.code) && op.attempts < MAX_AUTO_RETRIES) {
      op.attempts += 1;
      clearTimer ??= setTimeout(() => { clearTimer = null; enqueueClear(op); }, backoffDelay(op.attempts));
    } else {
      op.exhausted = true;
    }
    throw storageError;
  }
  const index = pendingClears.indexOf(op);
  if (index !== -1) { pendingClears.splice(index, 1); }
  purgeFor(op);
  pruneCleared();
  if (puts.size > 0 || deletes.size > 0) { schedule(); }
  settleIfIdle();
}

export function restore(apply: () => void): void {
  restoring++;
  try {
    apply();
  } finally {
    restoring--;
  }
}

export async function readRecord(key: string): Promise<unknown> {
  return recordGet(key).catch(() => null);
}

export async function readRange(prefix: string, from = '', to = '\uFFFF'): Promise<IdbEntry[]> {
  const rows = await recordsRange(prefix + from, prefix + to);
  return rows.map(([key, value]): IdbEntry => [key.slice(prefix.length), value]);
}

export function persistMap<S>(store: MapStore<S>, select: (s: S) => Readonly<Record<string, unknown>>, prefix: string): void {
  store.subscribe((state, prev) => {
    const next = select(state);
    const before = select(prev);
    if (next === before) { return; }
    for (const [key, value] of Object.entries(next)) {
      if (value === before[key]) { continue; }
      if (value === undefined) { deleteRecord(prefix + key); } else { putRecord(prefix + key, value); }
    }
    for (const key of Object.keys(before)) {
      if (!(key in next)) { deleteRecord(prefix + key); }
    }
  });
}
