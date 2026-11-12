import type { Settings } from '../../types';
import type { SettingsSlice, SliceCreator } from '../types';

export const defaultSettings: Settings = {
  apiKey: '',
  server: '',
  tempUnit: 'C',
  windUnit: 'kmh',
  snapshotMinutes: 60,
  backfill: true,
  accent: 'red',
};

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set) => ({
  settings: defaultSettings,
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
});
