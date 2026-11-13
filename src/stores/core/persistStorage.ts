import { isRecord } from './guards';
import { idbDel, idbGet, idbSet } from './idb';

import type { HydratablePersist, PendingWrite } from './types';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

const WRITE_DEBOUNCE_MS = 250;

function isStorageValue<S>(value: unknown): value is StorageValue<S> {
  return isRecord(value) && isRecord(value.state);
}

const pending = new Map<string, PendingWrite>();

function flush(name: string): void {
  const write = pending.get(name);
  if (!write) { return; }
  pending.delete(name);
  void idbSet(name, write.value);
}

function flushAll(): void {
  for (const name of pending.keys()) { flush(name); }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { flushAll(); } });
}

export function idbStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      const value = await idbGet(name);
      return isStorageValue<S>(value) ? value : null;
    },
    setItem: (name, value) => {
      const existing = pending.get(name);
      if (existing) { clearTimeout(existing.timer); }
      pending.set(name, { value, timer: setTimeout(() => { flush(name); }, WRITE_DEBOUNCE_MS) });
    },
    removeItem: async (name) => {
      const existing = pending.get(name);
      if (existing) {
        clearTimeout(existing.timer);
        pending.delete(name);
      }
      await idbDel(name);
    },
  };
}

export async function waitForHydration(store: HydratablePersist): Promise<void> {
  if (store.persist.hasHydrated()) { return; }
  await new Promise<void>((resolve) => {
    const unsub = store.persist.onFinishHydration(() => { unsub(); resolve(); });
    setTimeout(() => { unsub(); resolve(); }, 3000);
  });
}

export { type HydratablePersist } from './types';