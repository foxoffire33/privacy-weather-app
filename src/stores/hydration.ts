import { waitForHydration } from './core/persistStorage';
import type { Rehydratable } from './core/types';
import { importLegacyStore } from './migrateLegacy';
import { useEntityCache } from './entities/cache';
import { useSettingsStore } from './settingsStore';
import { useCityStore } from './cityStore';
import { useForecastStore } from './forecastStore';
import { useLogStore } from './logStore';
import { useDayStore } from './dayStore';
import { useAlmanacStore } from './almanacStore';
import { useBootStore } from './bootStore';

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

export function hydrateAll(): Promise<void> {
  booting ??= (async () => {
    await importLegacyStore().catch(() => false);
    await Promise.all(PERSISTED.map(async (store) => {
      await store.persist.rehydrate();
      await waitForHydration(store);
    }));
    useBootStore.setState({ hydrated: true });
  })();
  return booting;
}
