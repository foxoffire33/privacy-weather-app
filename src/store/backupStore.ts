import { create } from 'zustand';
import { errorMessage, exportSnapshot, importBackup } from '../storesV2';
import { countDays, parseBackup } from '../lib/backup';
import { downloadFile } from '../lib/format';
import type { BackupState } from '../types';

export type { BackupState } from '../types';

export const useBackupStore = create<BackupState>()((set, get) => ({
  pending: null,
  parts: { cities: true, history: true, settings: false },
  result: null,

  pick: async (file) => {
    set({ result: null });
    if (file === null) return;
    try {
      const backup = parseBackup(await file.text());
      set({ pending: backup, parts: { cities: backup.cities.length > 0, history: countDays(backup) > 0, settings: false } });
    } catch (e) {
      set({ pending: null, result: { ok: false, error: errorMessage(e) } });
    }
  },

  setPart: (part, on) => set((s) => ({ parts: { ...s.parts, [part]: on } })),

  confirm: () => {
    const { pending, parts } = get();
    if (pending === null) return;
    const counts = importBackup(pending, parts);
    set({ pending: null, result: { ok: true, ...counts } });
  },

  cancel: () => set({ pending: null }),

  exportFile: () => {
    const { cities, history, settings } = exportSnapshot();
    const { apiKey: _omit, ...safeSettings } = settings;
    const file = { version: 1, exportedAt: new Date().toISOString(), settings: safeSettings, cities, history };
    downloadFile('weather-log.json', JSON.stringify(file, null, 2), 'application/json');
  },
}));
