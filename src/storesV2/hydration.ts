import { waitForHydration } from './core/persist-storage';
import type { Rehydratable } from './core/types';
import { importLegacyStore } from './migrate-legacy';
import { useEntityCache } from './entities/cache';
import { useSettingsStore } from './stores/settings-store';
import { useCityStore } from './stores/city-store';
import { useForecastStore } from './stores/forecast-store';
import { useLogStore } from './stores/log-store';
import { useDayStore } from './stores/day-store';
import { useAlmanacStore } from './stores/almanac-store';

const PERSISTED: Rehydratable[] = [
  useEntityCache,
  useSettingsStore,
  useCityStore,
  useForecastStore,
  useLogStore,
  useDayStore,
  useAlmanacStore,
];

export function alreadyHydrated(): boolean {
  return PERSISTED.every((store) => store.persist.hasHydrated());
}

let booting: Promise<void> | null = null;

export async function hydrateAll(): Promise<void> {
  booting ??= (async () => {
    await importLegacyStore().catch(() => false);
    await Promise.all(PERSISTED.map(async (store) => {
      await store.persist.rehydrate();
      await waitForHydration(store);
    }));
  })();
  await booting;
}
