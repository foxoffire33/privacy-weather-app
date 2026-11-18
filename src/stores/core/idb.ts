import { errorMessage } from './errors';
import { sortedCopy } from './sort';

import type { BlockedListener, IdbEntry, ResponseRecord } from './types';

export type StorageErrorCode =
  | 'unavailable'
  | 'open-failed'
  | 'blocked'
  | 'read-failed'
  | 'write-failed'
  | 'quota-exceeded'
  | 'transaction-aborted'
  | 'corrupt-data';

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

const DOM_CODE: Readonly<Record<string, StorageErrorCode>> = {
  QuotaExceededError: 'quota-exceeded',
  AbortError: 'transaction-aborted',
  InvalidStateError: 'unavailable',
  BlockedError: 'blocked',
};

const OP_CODE: Readonly<Record<'open' | 'read' | 'write', StorageErrorCode>> = {
  open: 'open-failed',
  read: 'read-failed',
  write: 'write-failed',
};

const OP_MESSAGE: Readonly<Record<'open' | 'read' | 'write', string>> = {
  open: 'IndexedDB open failed',
  read: 'IndexedDB read failed',
  write: 'IndexedDB write failed',
};

export const RETRYABLE_WRITE_CODES: ReadonlySet<StorageErrorCode> = new Set(['open-failed', 'blocked', 'quota-exceeded', 'transaction-aborted', 'unavailable', 'write-failed']);

export function toStorageError(operation: 'open' | 'read' | 'write', cause: unknown): StorageError {
  if (cause instanceof StorageError) { return cause; }
  const code: StorageErrorCode = cause instanceof DOMException && cause.name in DOM_CODE ? DOM_CODE[cause.name] : OP_CODE[operation];
  return new StorageError(code, `${OP_MESSAGE[operation]}: ${errorMessage(cause)}`, { cause });
}

const DB_NAME = 'wl-storesv2';
const DB_VERSION = 2;
const TX_TIMEOUT_MS = 10_000;
const TX_SETTLE_GRACE_MS = 1000;
const KV = 'kv';
const RECORDS = 'records';
const RESPONSES = 'responses';
const RELAXED: IDBTransactionOptions = { durability: 'relaxed' };
const STRICT: IDBTransactionOptions = { durability: 'strict' };

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

function noteClosedConnection(error: unknown): void {
  if (error instanceof DOMException && error.name === 'InvalidStateError') { dbPromise = null; }
}

function abortIfActive(tx: IDBTransaction | undefined): boolean {
  if (tx === undefined) { return true; }
  try {
    tx.abort();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'InvalidStateError') { return false; }
    throw error;
  }
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    let settled = false;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(toStorageError('open', error));
      return;
    }
    const openError = (): DOMException | null => {
      try {
        return request.error;
      } catch {
        return null;
      }
    };
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      for (const name of [KV, RECORDS, RESPONSES]) {
        if (!db.objectStoreNames.contains(name)) { db.createObjectStore(name); }
      }
    });
    request.addEventListener('blocked', () => {
      blockedListener?.(true);
      settled = true;
      reject(new StorageError('blocked', 'IndexedDB upgrade is blocked by another tab', { cause: openError() }));
    });
    request.addEventListener('success', () => {
      blockedListener?.(false);
      if (settled) { request.result.close(); return; }
      settled = true;
      resolve(manage(request.result));
    });
    request.addEventListener('error', () => {
      settled = true;
      reject(toStorageError('open', openError() ?? new Error('IndexedDB open failed')));
    });
  });
  return dbPromise.catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
}

async function database(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) { throw new StorageError('unavailable', 'IndexedDB is not available in this environment'); }
  return openDb();
}

async function read<T>(store: string, request: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await database();
  return new Promise<T | undefined>((resolve, reject) => {
    const req = request(db.transaction(store, 'readonly').objectStore(store));
    req.addEventListener('success', () => { resolve(req.result); });
    req.addEventListener('error', () => { reject(toStorageError('read', req.error)); });
  }).catch((error: unknown) => {
    noteClosedConnection(error);
    throw toStorageError('read', error);
  });
}

async function withTransaction(db: IDBDatabase, stores: string | string[], change: (tx: IDBTransaction) => void, options?: IDBTransactionOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction | undefined;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (outcome: 'done' | 'failed', error?: unknown): void => {
      if (settled) { return; }
      settled = true;
      if (timer !== null) { clearTimeout(timer); }
      if (outcome === 'done') { resolve(); } else { reject(toStorageError('write', error ?? tx?.error)); }
    };
    try {
      tx = db.transaction(stores, 'readwrite', options);
      tx.addEventListener('complete', () => { finish('done'); });
      tx.addEventListener('abort', () => { finish('failed'); });
      change(tx);
      timer = setTimeout(() => {
        if (abortIfActive(tx)) {
          finish('failed', new DOMException('write transaction timed out', 'AbortError'));
          return;
        }
        timer = setTimeout(() => { finish('failed', new DOMException('write transaction timed out', 'AbortError')); }, TX_SETTLE_GRACE_MS);
      }, TX_TIMEOUT_MS);
    } catch (error) {
      noteClosedConnection(error);
      finish('failed', error);
      abortIfActive(tx);
    }
  });
}

async function write(store: string, change: (s: IDBObjectStore) => void): Promise<void> {
  if (!hasIndexedDb()) { throw new StorageError('unavailable', 'IndexedDB is not available in this environment'); }
  const db = await openDb();
  await withTransaction(db, store, (tx) => { change(tx.objectStore(store)); }, store === RESPONSES ? RELAXED : STRICT);
}

export async function writeImport(kv: readonly IdbEntry[], records: readonly IdbEntry[]): Promise<void> {
  if (kv.length === 0 && records.length === 0) { return; }
  const db = await database();
  await withTransaction(db, [KV, RECORDS], (tx) => {
    const settings = tx.objectStore(KV);
    const entries = tx.objectStore(RECORDS);
    for (const [key, value] of kv) { settings.put(value, key); }
    for (const [key, value] of records) { entries.put(value, key); }
  }, STRICT);
}

export async function idbGet(key: string): Promise<unknown> {
  return read(KV, (s) => s.get(key));
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await write(KV, (s) => { s.put(value, key); });
}

export async function idbDel(key: string): Promise<void> {
  await write(KV, (s) => { s.delete(key); });
}

export async function recordGet(key: string): Promise<unknown> {
  return read(RECORDS, (s) => s.get(key));
}

export async function recordsWrite(puts: readonly IdbEntry[], deletes: readonly string[]): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) { return; }
  await write(RECORDS, (s) => {
    for (const key of deletes) { s.delete(key); }
    for (const [key, value] of puts) { s.put(value, key); }
  });
}

export async function recordsWriteMissing(entries: readonly IdbEntry[]): Promise<void> {
  if (entries.length === 0) { return; }
  await write(RECORDS, (s) => {
    for (const [key, value] of entries) {
      const found = s.count(key);
      found.addEventListener('success', () => { if (found.result === 0) { s.put(value, key); } });
    }
  });
}

export async function recordsDeletePrefix(prefix: string): Promise<void> {
  await write(RECORDS, (s) => { s.delete(IDBKeyRange.bound(prefix, `${prefix}\uFFFF`)); });
}

export async function recordsDeletePrefixes(prefixes: readonly string[]): Promise<void> {
  if (prefixes.length === 0) { return; }
  await write(RECORDS, (s) => {
    for (const prefix of prefixes) { s.delete(IDBKeyRange.bound(prefix, `${prefix}\uFFFF`)); }
  });
}

export async function recordsRange(lower: string, upper: string): Promise<IdbEntry[]> {
  const db = await database();
  return new Promise<IdbEntry[]>((resolve, reject) => {
    const tx = db.transaction(RECORDS, 'readonly');
    const store = tx.objectStore(RECORDS);
    const range = IDBKeyRange.bound(lower, upper);
    const keys = store.getAllKeys(range);
    const values = store.getAll(range);
    let settled = false;
    const fail = (): void => { if (!settled) { settled = true; reject(toStorageError('read', tx.error)); } };
    tx.addEventListener('complete', () => {
      if (settled) { return; }
      settled = true;
      const out: IdbEntry[] = [];
      for (const [i, key] of keys.result.entries()) {
        if (typeof key === 'string') { out.push([key, values.result[i]]); }
      }
      resolve(out);
    });
    tx.addEventListener('abort', fail);
  }).catch((error: unknown) => {
    noteClosedConnection(error);
    throw toStorageError('read', error);
  });
}

export async function responseGet(key: string): Promise<ResponseRecord | undefined> {
  const value: unknown = await read(RESPONSES, (s) => s.get(key));
  return isResponseRecord(value) ? value : undefined;
}

export async function responsePut(key: string, record: ResponseRecord): Promise<void> {
  await write(RESPONSES, (s) => { s.put(record, key); });
}

export async function responsesPrune(now: number, keep: number): Promise<number> {
  let dropped = 0;
  await write(RESPONSES, (s) => {
    if (keep === 0) {
      const count = s.count();
      count.addEventListener('success', () => { dropped = count.result; s.clear(); });
      return;
    }
    const values = s.getAll();
    const keys = s.getAllKeys();
    keys.addEventListener('success', () => {
      const all = values.result;
      const allKeys = keys.result;
      if (all.length !== allKeys.length) { return; }
      const rows = allKeys.flatMap((key, i) => {
        const value: unknown = all[i];
        return typeof key === 'string' && isResponseRecord(value) ? [{ key, value }] : [];
      });
      const fresh = rows.filter((r) => r.value.expiresAt > now);
      const keepKeys = new Set(sortedCopy(fresh, (a, b) => b.value.fetchedAt - a.value.fetchedAt).slice(0, keep).map((r) => r.key));
      const drop = rows.filter((r) => !keepKeys.has(r.key)).map((r) => r.key);
      for (const key of drop) { s.delete(key); }
      dropped = drop.length;
    });
  });
  return dropped;
}

function isResponseRecord(value: unknown): value is ResponseRecord {
  return typeof value === 'object' && value !== null && 'fetchedAt' in value && 'expiresAt' in value && 'body' in value;
}
