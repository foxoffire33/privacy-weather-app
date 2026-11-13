import { waitForHydration, type HydratablePersist } from './core/persist-storage';
import { importLegacyStore } from './migrate-legacy';
import { useEntityCache } from './entities/cache';
import { useSettingsStore } from './settings-store';
import { useCityStore } from './city-store';
import { useForecastStore } from './forecast-store';
import { useLogStore } from './log-store';
import { useDayStore } from './day-store';
import { useAlmanacStore } from './almanac-store';

interface Rehydratable extends HydratablePersist {
  persist: HydratablePersist['persist'] & { rehydrate: () => Promise<void> | void };
}

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
