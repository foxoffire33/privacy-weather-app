const DB_NAME = 'wl-storesv2';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) { db.createObjectStore(STORE_NAME); }
    });
    request.addEventListener('success', () => { resolve(request.result); });
    request.addEventListener('error', () => { reject(request.error ?? new Error('IndexedDB open failed')); });
  });
  return dbPromise;
}

async function database(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) { return null; }
  return openDb().catch(() => null);
}

async function read<T>(request: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await database();
  if (db === null) { return null; }
  return new Promise<T | null>((resolve) => {
    const req = request(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME));
    req.addEventListener('success', () => { resolve(req.result); });
    req.addEventListener('error', () => { resolve(null); });
  }).catch(() => null);
}

async function write(change: (store: IDBObjectStore) => void): Promise<void> {
  const db = await database();
  if (db === null) { return; }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    change(tx.objectStore(STORE_NAME));
    tx.addEventListener('complete', () => { resolve(); });
    tx.addEventListener('error', () => { resolve(); });
  }).catch(() => null);
}

export async function idbGet(key: string): Promise<unknown> {
  const value: unknown = await read((store) => store.get(key));
  return value ?? null;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await write((store) => { store.put(value, key); });
}

export async function idbDel(key: string): Promise<void> {
  await write((store) => { store.delete(key); });
}

