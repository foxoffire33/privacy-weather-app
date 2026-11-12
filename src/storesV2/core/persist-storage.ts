import { idbDel, idbGet, idbSet } from './idb';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import type { HydratablePersist } from './types';

export type { HydratablePersist };

const WRITE_DEBOUNCE_MS = 250;

const pending = new Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }>();

function flush(name: string): void {
  const write = pending.get(name);
  if (!write) return;
  pending.delete(name);
  void idbSet(name, write.value);
}

function flushAll(): void {
  for (const name of [...pending.keys()]) flush(name);
}

if (typeof document !== 'undefined') {
  document.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
}

export function idbStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => await idbGet<StorageValue<S>>(name),
    setItem: (name, value) => {
      const existing = pending.get(name);
      if (existing) clearTimeout(existing.timer);
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
  if (store.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = store.persist.onFinishHydration(() => { unsub(); resolve(); });
    setTimeout(() => { unsub(); resolve(); }, 3000);
  });
}
