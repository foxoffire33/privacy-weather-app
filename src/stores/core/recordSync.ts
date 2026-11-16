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
const deletes = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let restoring = 0;

let chain: Promise<void> = Promise.resolve();
const clearedPrefixes: string[] = [];
const touched = new Set<string>();

let attempts = 0;
let lastError: StorageError | null = null;
let faultListener: ((error: StorageError) => void) | null = null;

export function onRecordFault(listener: ((error: StorageError) => void) | null): void {
  faultListener = listener;
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

async function flushOnce(): Promise<StorageError | null> {
  if (puts.size === 0 && deletes.size === 0) { return null; }
  const batch: IdbEntry[] = [...puts];
  const gone = [...deletes];
  const clearMark = clearedPrefixes.length;
  puts.clear();
  deletes.clear();
  try {
    await measure('persist-flush', async () => recordsWrite(batch, gone));
  } catch (error) {
    const storageError = toStorageError('write', error);
    requeue(batch, gone, clearedPrefixes.slice(clearMark));
    lastError = storageError;
    if (RETRYABLE_WRITE_CODES.has(storageError.code) && attempts < MAX_AUTO_RETRIES) {
      attempts += 1;
      timer ??= setTimeout(() => { timer = null; void flushRecords().catch(reportFault); }, backoffDelay(attempts));
    }
    return storageError;
  }
  attempts = 0;
  lastError = null;
  return null;
}

export async function flushRecords(): Promise<void> {
  if (timer !== null) { clearTimeout(timer); }
  timer = null;
  let outcome: StorageError | null;
  chain = chain.then(
    async () => { outcome = await flushOnce(); },
    async () => { await flushOnce(); },
  );
  return chain.then(() => {
    if (outcome !== null) {
      throw outcome;
    }
  });
}

const newer = (key: string): boolean => puts.has(key) || deletes.has(key);

function requeue(batch: readonly IdbEntry[], gone: readonly string[], clearedSince: readonly string[]): void {
  const keep = (key: string) => !newer(key) && !clearedSince.some((prefix) => key.startsWith(prefix));
  for (const [key, value] of batch) { if (keep(key)) { puts.set(key, value); } }
  for (const key of gone) { if (keep(key)) { deletes.add(key); } }
}


function schedule(): void {
  attempts = 0;
  timer ??= setTimeout(() => { timer = null; void flushRecords().catch(reportFault); }, FLUSH_MS);
}

if (typeof document !== 'undefined') {
  document.addEventListener('pagehide', () => { void flushRecords().catch(reportFault); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { void flushRecords().catch(reportFault); } });
}

export function changedSinceStart(key: string): boolean {
  return touched.has(key) || clearedPrefixes.some((prefix) => key.startsWith(prefix));
}

export function putRecord(key: string, value: unknown): void {
  if (restoring > 0) { return; }
  touched.add(key);
  deletes.delete(key);
  puts.set(key, value);
  schedule();
}

export function deleteRecord(key: string): void {
  if (restoring > 0) { return; }
  touched.add(key);
  puts.delete(key);
  deletes.add(key);
  schedule();
}

export async function clearRecords(prefix: string): Promise<void> {
  clearedPrefixes.push(prefix);
  for (const key of puts.keys()) { if (key.startsWith(prefix)) { puts.delete(key); } }
  for (const key of deletes) { if (key.startsWith(prefix)) { deletes.delete(key); } }
  return new Promise<void>((resolve, reject) => {
    chain = chain.then(
      async () => {
        try {
          await recordsDeletePrefix(prefix);
          resolve();
        } catch (error) {
          reject(toStorageError('write', error));
        }
      },
      (error: unknown) => { reject(toStorageError('write', error)); },
    );
  });
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
