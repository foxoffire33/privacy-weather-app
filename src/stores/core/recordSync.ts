import { recordGet, recordsDeletePrefix, recordsRange, recordsWrite, toStorageError } from './idb';
import { measure } from './marks';

import type { IdbEntry, MapStore } from './types';

const FLUSH_MS = 250;

const puts = new Map<string, unknown>();
const deletes = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let restoring = 0;

let chain: Promise<void> = Promise.resolve();
const clearedPrefixes: string[] = [];
const touched = new Set<string>();

async function flushOnce(): Promise<void> {
  if (puts.size === 0 && deletes.size === 0) { return; }
  const batch: IdbEntry[] = [...puts];
  const gone = [...deletes];
  const clearMark = clearedPrefixes.length;
  puts.clear();
  deletes.clear();
  try {
    await measure('persist-flush', async () => recordsWrite(batch, gone));
  } catch {
    requeue(batch, gone, clearedPrefixes.slice(clearMark));
  }
}

export async function flushRecords(): Promise<void> {
  if (timer !== null) { clearTimeout(timer); }
  timer = null;
  chain = chain.then(flushOnce, flushOnce);
  return chain;
}

const newer = (key: string): boolean => puts.has(key) || deletes.has(key);

function requeue(batch: readonly IdbEntry[], gone: readonly string[], clearedSince: readonly string[]): void {
  const keep = (key: string) => !newer(key) && !clearedSince.some((prefix) => key.startsWith(prefix));
  for (const [key, value] of batch) { if (keep(key)) { puts.set(key, value); } }
  for (const key of gone) { if (keep(key)) { deletes.add(key); } }
  schedule();
}


function schedule(): void {
  timer ??= setTimeout(() => { void flushRecords(); }, FLUSH_MS);
}

if (typeof document !== 'undefined') {
  document.addEventListener('pagehide', () => { void flushRecords(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { void flushRecords(); } });
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
