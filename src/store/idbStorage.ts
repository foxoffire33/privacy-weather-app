import { get, set, del } from 'idb-keyval';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

// Zustand persist storage backed by IndexedDB. Values are stored as structured
// clones (no JSON), and writes are debounced so rapid state changes cost one write.
export function idbStorage<S>(delayMs = 250): PersistStorage<S> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    getItem: async (name) => (await get<StorageValue<S>>(name)) ?? null,
    setItem: (name, value) => {
      clearTimeout(timers.get(name));
      timers.set(name, setTimeout(() => { set(name, value); }, delayMs));
    },
    removeItem: async (name) => { await del(name); },
  };
}
