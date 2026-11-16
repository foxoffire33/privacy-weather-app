import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { configureDataLayer } from './core/config';
import { idbStorage } from './core/persistStorage';

import type { SettingsState } from './storeTypes';
import type { Settings } from './types';

export const PUBLIC_RADAR_SERVER = 'https://api.librewxr.net';
export const PUBLIC_MAP_SERVER = 'https://tiles.openfreemap.org/planet';

const defaultSettings: Settings = {
  apiKey: '',
  server: '',
  radarServer: PUBLIC_RADAR_SERVER,
  mapServer: PUBLIC_MAP_SERVER,
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
