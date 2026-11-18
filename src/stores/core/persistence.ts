import { responsesPrune } from './idb';

let asked = false;
const cacheClearListeners = new Set<() => void>();

export function onCacheCleared(listener: () => void): () => void {
  cacheClearListeners.add(listener);
  return () => { cacheClearListeners.delete(listener); };
}

const LOW_HEADROOM_BYTES = 10_485_760;

export interface StorageEstimate {
  quota: number;
  usage: number;
  headroom: number;
  low: boolean;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (asked || typeof navigator === 'undefined' || !('storage' in navigator)) { return false; }
  asked = true;
  if (await navigator.storage.persisted()) { return true; }
  return navigator.storage.persist();
}

export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) { return null; }
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    return { quota, usage, headroom: quota - usage, low: quota > 0 && quota - usage < LOW_HEADROOM_BYTES };
  } catch {
    return null;
  }
}

export async function clearResponseCache(): Promise<number> {
  const removed = await responsesPrune(Date.now(), 0);
  for (const listener of cacheClearListeners) { listener(); }
  return removed;
}
