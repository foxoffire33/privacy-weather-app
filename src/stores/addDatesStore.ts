import { create } from 'zustand';
import { addDateRange, addDays, errorMessage } from '.';
import type { AddDatesState } from '../types';

export type { AddDatesState } from '../types';

export const useAddDatesStore = create<AddDatesState>()((set, get) => ({
  draft: { from: '', to: '' },
  result: null,
  runId: 0,

  reset: (maxDate) => set((s) => ({ draft: { from: addDays(maxDate, -29), to: maxDate }, result: null, runId: s.runId + 1 })),
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

  run: async (cityId) => {
    const { from, to } = get().draft;
    const id = get().runId + 1;
    set({ result: null, runId: id });
    try {
      const counts = await addDateRange(cityId, from, to);
      if (get().runId === id) set({ result: { ok: true, ...counts } });
    } catch (e) {
      if (get().runId === id) set({ result: { ok: false, error: errorMessage(e) } });
    }
  },
}));
