import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { configureDataLayer } from './core/config';
import { idbStorage } from './core/persistStorage';

import type { SettingsState } from './storeTypes';
import type { Settings } from './types';

const defaultSettings: Settings = {
  apiKey: '',
  server: '',
  tempUnit: 'C',
  windUnit: 'kmh',
  snapshotMinutes: 60,
  backfill: true,
  accent: 'green',
  accentColor: '#178a4a',
  language: 'system',
  offline: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'wl2-settings',
      version: 1,
      storage: idbStorage(),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, settings: { ...current.settings, ...p.settings } };
      },
    },
  ),
);

function publishApiConfig(s: Settings): void {
  configureDataLayer({ apiKey: s.apiKey, server: s.server, offline: s.offline });
}

publishApiConfig(useSettingsStore.getState().settings);

let lastKey = '';
useSettingsStore.subscribe((state) => {
  const { apiKey, server, offline } = state.settings;
  const key = `${apiKey}\u0000${server}\u0000${String(offline)}`;
  if (key === lastKey) {return;}
  lastKey = key;
  publishApiConfig(state.settings);
});
