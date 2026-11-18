import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { configureDataLayer } from './core/config';
import { isRecord } from './core/guards';
import { idbStorage, registerRehydration, trackRehydration } from './core/persistStorage';
import { defaultSettings, validatePersistedSettings } from './settingsSchema';

import type { SettingsState } from './storeTypes';
import type { Settings } from './types';

const NAME = 'wl2-settings';

let validationIssues: string[] = [];
const editedFields = new Set<string>();

export function settingsValidationIssues(): string[] {
  return validationIssues;
}

function mergePersisted(persisted: unknown, current: SettingsState): SettingsState {
  if (!isRecord(persisted)) {
    validationIssues = [];
    return current;
  }
  const { value, issues } = validatePersistedSettings(persisted.settings);
  validationIssues = issues;
  const edited = Object.fromEntries([...editedFields].map((key) => [key, Reflect.get(current.settings, key)]));
  return { ...current, settings: { ...value, ...edited } };
}

const snapshot = (): unknown => ({ state: { settings: useSettingsStore.getState().settings }, version: 1 });

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (patch) => {
        for (const key of Object.keys(patch)) { editedFields.add(key); }
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },
    }),
    {
      name: NAME,
      version: 1,
      storage: idbStorage(),
      skipHydration: true,
      onRehydrateStorage: (state) => {
        const finish = trackRehydration(NAME, snapshot)(state);
        return (hydrated, error) => {
          finish(hydrated, error);
          if (error === undefined) { editedFields.clear(); }
        };
      },
      partialize: (s) => ({ settings: s.settings }),
      merge: mergePersisted,
    },
  ),
);

registerRehydration(NAME, async () => { await useSettingsStore.persist.rehydrate(); });

function publishApiConfig(s: Settings): void {
  configureDataLayer({ apiKey: s.apiKey, server: s.server, radarServer: s.radarServer, mapServer: s.mapServer, offline: s.offline });
}

publishApiConfig(useSettingsStore.getState().settings);

let lastKey = '';
useSettingsStore.subscribe((state) => {
  const { apiKey, server, radarServer, mapServer, offline } = state.settings;
  const key = [apiKey, server, radarServer, mapServer, String(offline)].join('\u0000');
  if (key === lastKey) {return;}
  lastKey = key;
  publishApiConfig(state.settings);
});
