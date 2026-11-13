import { useAlmanacStore } from './almanacStore';
import { useBootStore } from './bootStore';
import { useCityStore } from './cityStore';
import { waitForHydration } from './core/persistStorage';
import { useDayStore } from './dayStore';
import { useEntityCache } from './entities/cache';
import { useForecastStore } from './forecastStore';
import { useLogStore } from './logStore';
import { importLegacyStore } from './migrateLegacy';
import { useSettingsStore } from './settingsStore';

import type { Pending, Rehydratable } from './core/types';

const PERSISTED: Rehydratable[] = [
  useEntityCache,
  useSettingsStore,
  useCityStore,
  useForecastStore,
  useLogStore,
  useDayStore,
  useAlmanacStore,
];

let booting: Promise<void> | null = null;

export function hydrateAll(): Pending {
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
