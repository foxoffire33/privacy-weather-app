import { create } from 'zustand';
import { addDateRange, addDays, errorMessage } from '../storesV2';
import type { AddDatesState } from '../types';

export type { AddDatesState } from '../types';

export const useAddDatesStore = create<AddDatesState>()((set, get) => ({
  draft: { from: '', to: '' },
  result: null,

  reset: (maxDate) => set({ draft: { from: addDays(maxDate, -29), to: maxDate }, result: null }),
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

  run: async (cityId) => {
    const { from, to } = get().draft;
    set({ result: null });
    try {
      const counts = await addDateRange(cityId, from, to);
      set({ result: { ok: true, ...counts } });
    } catch (e) {
      set({ result: { ok: false, error: errorMessage(e) } });
    }
  },
}));
