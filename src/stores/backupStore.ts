import { create } from 'zustand';

import { MAX_BACKUP_BYTES, countDays, exportBackupFiles, parseBackup } from '../backup/backup';
import { t } from '../i18n';
import { downloadFile } from '../utils/format';

import { useCityStore } from './cityStore';
import { inSequence } from './core/guards';

import { errorMessage, exportSnapshot, flushPersistedState, importBackup, whenHistoryReady } from '.';

import type { BackupState } from '../types';

export const useBackupStore = create<BackupState>()((set, get) => ({
  pending: null,
  importing: false,
  exportParts: 0,
  parts: { cities: true, history: true, settings: false },
  result: null,
  pickId: 0,

  pick: async (file) => {
    if (get().importing) { return; }
    const id = get().pickId + 1;
    set({ result: null, pickId: id });
    if (file === null) { return; }
    set({ pending: null });
    try {
      if (file.size > MAX_BACKUP_BYTES) { throw new Error(t('backup.tooLarge')); }
      const backup = parseBackup(await file.text(), new Set(useCityStore.getState().cityIds));
      if (get().pickId !== id) { return; }
      set({ pending: backup, parts: { cities: backup.cities.length > 0, history: countDays(backup) > 0, settings: false } });
    } catch (error) {
      if (get().pickId !== id) { return; }
      set({ pending: null, result: { ok: false, error: errorMessage(error) } });
    }
  },

  setPart: (part, on) => { set((s) => ({ parts: { ...s.parts, [part]: on } })); },

  confirm: async () => {
    const { pending, parts, importing } = get();
    if (pending === null || importing) { return; }
    set({ importing: true });
    try {
      const counts = await importBackup(pending, parts);
      set({ pending: null, result: { ok: true, ...counts } });
    } catch (error) {
      set({ result: { ok: false, error: errorMessage(error) } });
    } finally {
      set({ importing: false });
    }
  },

  cancel: () => { set({ pending: null }); },

  exportFile: async () => {
    try {
      await whenHistoryReady();
      await flushPersistedState();
      const files = exportBackupFiles(exportSnapshot());
      await inSequence(files, async (file) => { await downloadFile(file.name, file.text, 'application/json'); });
      set({ exportParts: files.length, result: null });
    } catch (error) {
      set({ exportParts: 0, result: { ok: false, error: `${t('backup.exportFailed')} ${errorMessage(error)}` } });
    }
  },
}));
