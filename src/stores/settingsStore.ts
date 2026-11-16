import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { configureDataLayer } from './core/config';
import { idbStorage } from './core/persistStorage';

import type { SettingsState } from './storeTypes';
import type { Settings } from './types';

const defaultSettings: Settings = {
  apiKey: '',
  server: '',
  radarServer: '',
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
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, settings: { ...current.settings, ...p.settings } };
      },
    },
  ),
);

function publishApiConfig(s: Settings): void {
  configureDataLayer({ apiKey: s.apiKey, server: s.server, radarServer: s.radarServer, offline: s.offline });
}

publishApiConfig(useSettingsStore.getState().settings);

let lastKey = '';
useSettingsStore.subscribe((state) => {
  const { apiKey, server, radarServer, offline } = state.settings;
  const key = [apiKey, server, radarServer, String(offline)].join('\u0000');
  if (key === lastKey) {return;}
  lastKey = key;
  publishApiConfig(state.settings);
});
