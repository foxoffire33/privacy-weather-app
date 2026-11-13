import { useI18n } from '../i18n';

import { useAlmanacStore } from './almanacStore';
import { useCityStore } from './cityStore';
import { waitForHydration  } from './core/persistStorage';
import { useDayStore } from './dayStore';
import { useEntityCache } from './entities/cache';
import { useForecastStore } from './forecastStore';
import { useLogStore } from './logStore';
import { importLegacyStore } from './migrateLegacy';
import { useSettingsStore } from './settingsStore';

import type {HydratablePersist} from './core/persistStorage';

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

let booting: Promise<void> | null = null;

// Returns the same promise object on every call so it can be used with React's
// use() (which requires a stable promise) and awaited anywhere else.
export async function hydrateAll(): Promise<void> {
  booting ??= (async () => {
    await importLegacyStore().catch(() => false);
    await Promise.all(PERSISTED.map(async (store) => {
      await store.persist.rehydrate();
      await waitForHydration(store);
    }));
    // Load the configured locale so the first committed render is already translated.
    await useI18n.getState().setLanguage(useSettingsStore.getState().settings.language);
  })();
  return booting;
}
