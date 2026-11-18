import { create } from 'zustand';

import { classify } from './core/appError';
import { isOffline } from './core/config';
import { inSequence } from './core/guards';
import { READY } from './core/inflight';

import { addDays, begin, fail, fillRange, IDLE_QUERY, once, succeed, useLogStore } from '.';

import type { DateRange, TrendsState } from '../types';
import type { AppError } from './core/appError';

const DEFAULT_ATTRS = ['hi', 'lo', 'normal'];

export const windowKey = (cityId: string, w: DateRange): string => `${cityId}:${w.from}:${w.to}`;

export const trendsKey = (cityId: string, windows: DateRange[]): string => `trends:${windows.map((w) => windowKey(cityId, w)).join('|')}`;

export function hasGap(logged: readonly string[], w: DateRange): boolean {
  if (w.from > w.to) { return false; }
  const days = new Set(logged);
  for (let d = w.from; d <= w.to; d = addDays(d, 1)) {if (!days.has(d)) { return true; }}
  return false;
}

export function hasLogged(logged: readonly string[], w: DateRange): boolean {
  return logged.some((d) => d >= w.from && d <= w.to);
}

const loggedDates = (cityId: string): readonly string[] => useLogStore.getState().dates[cityId] ?? [];

export const useTrendsStore = create<TrendsState>()((set, get) => ({
  picked: DEFAULT_ATTRS,
  len: 30,
  custom: null,
  back: 0,
  rangeDraft: { from: '', to: '' },
  download: IDLE_QUERY,
  attempted: [],
  failed: [],
  failureErrors: {},

  togglePicked: (key) => { set((s) => ({
    picked: s.picked.includes(key) ? s.picked.filter((k) => k !== key) : [...s.picked, key],
  })); },
  setLen: (len) => { set({ len, custom: null }); },
  setCustom: (custom) => { set({ custom }); },
  setBack: (back) => { set({ back }); },
  setRangeDraft: (patch) => { set((s) => ({ rangeDraft: { ...s.rangeDraft, ...patch } })); },

  ensureWindows: (cityId, windows) => (isOffline() ? READY : once(trendsKey(cityId, windows), async () => {
    const tried = new Set(get().attempted);
    const wanted = windows.filter((w) => hasGap(loggedDates(cityId), w) && !tried.has(windowKey(cityId, w)));
    if (wanted.length === 0) { return; }
    set((s) => ({ download: begin(s.download), attempted: [...s.attempted, ...wanted.map((w) => windowKey(cityId, w))] }));
    const failures: Record<string, AppError> = {};
    const skipped = new Set<string>();
    await inSequence(wanted, async (w) => {
      const key = windowKey(cityId, w);
      if (isOffline()) { skipped.add(key); return; }
      try {
        await fillRange(cityId, w.from, w.to);
      } catch (error_) {
        if (isOffline()) { skipped.add(key); return; }
        failures[key] = classify(error_, key);
      }
    });
    set((s) => ({
      download: Object.keys(failures).length === 0 ? succeed() : fail(s.download, Object.values(failures)[0]),
      attempted: s.attempted.filter((k) => !skipped.has(k)),
      failed: [...s.failed.filter((k) => !wanted.some((w) => windowKey(cityId, w) === k)), ...Object.keys(failures)],
      failureErrors: { ...Object.fromEntries(Object.entries(s.failureErrors).filter(([key]) => !wanted.some((w) => windowKey(cityId, w) === key))), ...failures },
    }));
  })),

  retryFailed: async (cityId, windows) => {
    const keys = new Set(windows.map((w) => windowKey(cityId, w)).filter((k) => get().failed.includes(k)));
    if (keys.size === 0) { return; }
    set((s) => ({
      attempted: s.attempted.filter((k) => !keys.has(k)),
      failed: s.failed.filter((k) => !keys.has(k)),
      failureErrors: Object.fromEntries(Object.entries(s.failureErrors).filter(([key]) => !keys.has(key))),
      download: IDLE_QUERY,
    }));
    await get().ensureWindows(cityId, windows);
  },
}));
