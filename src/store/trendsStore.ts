import { create } from 'zustand';
import { addDays, begin, errorMessage, fail, fillRange, IDLE_QUERY, succeed, useLogStore } from '../storesV2';
import type { DateRange, TrendsState } from '../types';

export type { TrendsState } from '../types';

export const DEFAULT_ATTRS = ['hi', 'lo', 'normal'];

const windowKey = (cityId: string, w: DateRange) => `${cityId}:${w.from}:${w.to}`;

function hasGap(cityId: string, w: DateRange): boolean {
  if (w.from > w.to) return false;
  const logged = new Set(useLogStore.getState().dates[cityId] ?? []);
  for (let d = w.from; d <= w.to; d = addDays(d, 1)) if (!logged.has(d)) return true;
  return false;
}

export const useTrendsStore = create<TrendsState>()((set, get) => ({
  picked: DEFAULT_ATTRS,
  len: 30,
  custom: null,
  back: 0,
  rangeDraft: { from: '', to: '' },
  download: IDLE_QUERY,
  attempted: [],

  togglePicked: (key) => set((s) => ({
    picked: s.picked.includes(key) ? s.picked.filter((k) => k !== key) : [...s.picked, key],
  })),
  setLen: (len) => set({ len, custom: null }),
  setCustom: (custom) => set({ custom }),
  setBack: (back) => set({ back }),
  setRangeDraft: (patch) => set((s) => ({ rangeDraft: { ...s.rangeDraft, ...patch } })),

  ensureWindows: async (cityId, windows) => {
    const tried = new Set(get().attempted);
    const wanted = windows.filter((w) => hasGap(cityId, w) && !tried.has(windowKey(cityId, w)));
    if (wanted.length === 0) return;
    set((s) => ({ download: begin(s.download), attempted: [...s.attempted, ...wanted.map((w) => windowKey(cityId, w))] }));
    let error: string | null = null;
    for (const w of wanted) {
      try {
        await fillRange(cityId, w.from, w.to);
      } catch (e) {
        error = errorMessage(e);
      }
    }
    set((s) => ({ download: error === null ? succeed() : fail(s.download, error) }));
  },
}));
