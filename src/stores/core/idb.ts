const DB_NAME = 'wl-storesv2';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function keyToString(key: IDBValidKey): string {
  return typeof key === 'string' ? key : JSON.stringify(key);
}

async function openDb(): Promise<IDBDatabase> {
  if (dbPromise !== null) {return dbPromise;}

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {db.createObjectStore(STORE_NAME);}
    };
    request.onsuccess = () => { resolve(request.result); };
    request.onerror = () => { reject(request.error ?? new Error('IndexedDB open failed')); };
  });

  return dbPromise;
}

export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  if (!hasIndexedDb()) {return null;}
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => { resolve((req.result ?? null) as T | null); };
      req.onerror = () => { resolve(null); };
    });
  } catch {
    return null;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (!hasIndexedDb()) {return;}
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => { resolve(); };
      tx.onerror = () => { resolve(); };
    });
  } catch {}
}

export async function idbDel(key: string): Promise<void> {
  if (!hasIndexedDb()) {return;}
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => { resolve(); };
      tx.onerror = () => { resolve(); };
    });
  } catch {}
}

export async function idbKeys(): Promise<string[]> {
  if (!hasIndexedDb()) {return [];}
  try {
    const db = await openDb();
    return await new Promise<string[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => { resolve(req.result.map(keyToString)); };
      req.onerror = () => { resolve([]); };
    });
  } catch {
    return [];
  }
}
