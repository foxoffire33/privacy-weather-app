import { sortedCopy } from './sort';

import type { BlockedListener, IdbEntry, ResponseRecord } from './types';

const DB_NAME = 'wl-storesv2';
const DB_VERSION = 2;
const KV = 'kv';
const RECORDS = 'records';
const RESPONSES = 'responses';
const RELAXED: IDBTransactionOptions = { durability: 'relaxed' };

let dbPromise: Promise<IDBDatabase> | null = null;
let blockedListener: BlockedListener | null = null;

export function onUpgradeBlocked(listener: BlockedListener | null): void {
  blockedListener = listener;
}

function manage(db: IDBDatabase): IDBDatabase {
  db.addEventListener('versionchange', () => {
    db.close();
    dbPromise = null;
  });
  return db;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      for (const name of [KV, RECORDS, RESPONSES]) {
        if (!db.objectStoreNames.contains(name)) { db.createObjectStore(name); }
      }
    });
    request.addEventListener('blocked', () => { blockedListener?.(true); });
    request.addEventListener('success', () => {
      blockedListener?.(false);
      resolve(manage(request.result));
    });
    request.addEventListener('error', () => { reject(request.error ?? new Error('IndexedDB open failed')); });
  });
  return dbPromise.catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
}

async function database(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) { return null; }
  return openDb().catch(() => null);
}

async function read<T>(store: string, request: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await database();
  if (db === null) { return null; }
  return new Promise<T | null>((resolve) => {
    const req = request(db.transaction(store, 'readonly').objectStore(store));
    req.addEventListener('success', () => { resolve(req.result); });
    req.addEventListener('error', () => { resolve(null); });
  }).catch(() => null);
}

async function write(store: string, change: (s: IDBObjectStore) => void): Promise<void> {
  if (!hasIndexedDb()) { return; }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite', RELAXED);
    const fail = () => { reject(tx.error ?? new Error('IndexedDB write failed')); };
    tx.addEventListener('complete', () => { resolve(); });
    tx.addEventListener('error', fail);
    tx.addEventListener('abort', fail);
    change(tx.objectStore(store));
  });
}

export async function idbGet(key: string): Promise<unknown> {
  const value: unknown = await read(KV, (s) => s.get(key));
  return value ?? null;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await write(KV, (s) => { s.put(value, key); });
}

export async function idbDel(key: string): Promise<void> {
  await write(KV, (s) => { s.delete(key); });
}

export async function recordGet(key: string): Promise<unknown> {
  const value: unknown = await read(RECORDS, (s) => s.get(key));
  return value ?? null;
}

export async function recordsWrite(puts: readonly IdbEntry[], deletes: readonly string[]): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) { return; }
  await write(RECORDS, (s) => {
    for (const key of deletes) { s.delete(key); }
    for (const [key, value] of puts) { s.put(value, key); }
  });
}

export async function recordsDeletePrefix(prefix: string): Promise<void> {
  await write(RECORDS, (s) => { s.delete(IDBKeyRange.bound(prefix, `${prefix}\uFFFF`)); });
}

export async function recordsRange(lower: string, upper: string): Promise<IdbEntry[]> {
  const db = await database();
  if (db === null) { return []; }
  return new Promise<IdbEntry[]>((resolve) => {
    const tx = db.transaction(RECORDS, 'readonly');
    const store = tx.objectStore(RECORDS);
    const range = IDBKeyRange.bound(lower, upper);
    const keys = store.getAllKeys(range);
    const values = store.getAll(range);
    tx.addEventListener('complete', () => {
      const out: IdbEntry[] = [];
      for (const [i, key] of keys.result.entries()) {
        if (typeof key === 'string') { out.push([key, values.result[i]]); }
      }
      resolve(out);
    });
    tx.addEventListener('error', () => { resolve([]); });
    tx.addEventListener('abort', () => { resolve([]); });
  });
}

export async function responseGet(key: string): Promise<ResponseRecord | null> {
  const value: unknown = await read(RESPONSES, (s) => s.get(key));
  return isResponseRecord(value) ? value : null;
}

export async function responsePut(key: string, record: ResponseRecord): Promise<void> {
  await write(RESPONSES, (s) => { s.put(record, key); });
}

export async function responsesPrune(now: number, keep: number): Promise<void> {
  const all = await read(RESPONSES, (s) => s.getAll());
  const keys = await read(RESPONSES, (s) => s.getAllKeys());
  if (all?.length !== keys?.length || all === null || keys === null) { return; }
  const rows = keys.flatMap((key, i) => {
    const value: unknown = all[i];
    return typeof key === 'string' && isResponseRecord(value) ? [{ key, value }] : [];
  });
  const fresh = rows.filter((r) => r.value.expiresAt > now);
  const keepKeys = new Set(sortedCopy(fresh, (a, b) => b.value.fetchedAt - a.value.fetchedAt).slice(0, keep).map((r) => r.key));
  const drop = rows.filter((r) => !keepKeys.has(r.key)).map((r) => r.key);
  if (drop.length === 0) { return; }
  await write(RESPONSES, (s) => { for (const key of drop) { s.delete(key); } });
}

function isResponseRecord(value: unknown): value is ResponseRecord {
  return typeof value === 'object' && value !== null && 'fetchedAt' in value && 'expiresAt' in value && 'body' in value;
}
