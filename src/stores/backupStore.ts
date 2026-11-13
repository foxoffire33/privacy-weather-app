import { create } from 'zustand';

import { countDays, parseBackup } from '../lib/backup';
import { downloadFile } from '../lib/format';

import { errorMessage, exportSnapshot, importBackup } from '.';

import type { BackupState } from '../types';

export type { BackupState } from '../types';

export const useBackupStore = create<BackupState>()((set, get) => ({
  pending: null,
  parts: { cities: true, history: true, settings: false },
  result: null,
  pickId: 0,

  pick: async (file) => {
    const id = get().pickId + 1;
    set({ result: null, pickId: id });
    if (file === null) { return; }
    set({ pending: null });
    try {
      const backup = parseBackup(await file.text());
      if (get().pickId !== id) { return; }
      set({ pending: backup, parts: { cities: backup.cities.length > 0, history: countDays(backup) > 0, settings: false } });
    } catch (error) {
      if (get().pickId !== id) { return; }
      set({ pending: null, result: { ok: false, error: errorMessage(error) } });
    }
  },

  setPart: (part, on) => { set((s) => ({ parts: { ...s.parts, [part]: on } })); },

  confirm: () => {
    const { pending, parts } = get();
    if (pending === null) { return; }
    const counts = importBackup(pending, parts);
    set({ pending: null, result: { ok: true, ...counts } });
  },

  cancel: () => { set({ pending: null }); },

  exportFile: () => {
    const { cities, history, settings } = exportSnapshot();
    const { apiKey: _omit, ...safeSettings } = settings;
    const file = { version: 1, exportedAt: new Date().toISOString(), settings: safeSettings, cities, history };
    downloadFile('weather-log.json', JSON.stringify(file, null, 2), 'application/json');
  },
}));
