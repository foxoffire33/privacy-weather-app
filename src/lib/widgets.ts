import { Capacitor, registerPlugin } from '@capacitor/core';

import { useWeatherStore } from '../store';
import type { StoreState } from '../store/types';
import { addDays, convTemp, fmtDelta, fmtTemp, hhmm, hourOf, shortDate, weekday } from './format';
import { nowIndex, rainOutlook } from './insights';
import { conditionLabel } from './weatherCodes';

// Home-screen widgets (Android) for the default city. The app builds one snapshot of
// past, present and future from the store and hands it to the native side
// (android/.../WidgetsPlugin.java), which draws every widget from it. All text is
// formatted here, in the user's units, so the widgets match the app exactly.

interface WidgetsPlugin {
  update(options: { json: string }): Promise<void>;
}
const Widgets = registerPlugin<WidgetsPlugin>('Widgets');

type Day = { label: string; hi: number | null; lo: number | null; normal: number | null; kind: 'past' | 'today' | 'future' };
type Row = { label: string; v: number | null; text: string; kind: 'today' | 'avg' | 'year' };
type RainBar = { f: number; wet: boolean };

export interface WidgetSnapshot {
  v: 1;
  city: string;
  updated: string;
  now: { temp: string; cond: string; hi: string; lo: string; rain: string; delta: string | null };
  timeline: { days: Day[]; todayHi: string };
  thisDay: { date: string; rows: Row[] };
  rain: { text: string; bars: RainBar[]; from: string; to: string; caption: string };
  hours: { label: string; temp: string; p: number }[];
}

export function buildSnapshot(st: StoreState): WidgetSnapshot | null {
  const city = st.cities[0];
  const entry = city && st.forecasts[city.id];
  if (!city || !entry) return null;

  const unit = st.settings.tempUnit;
  const T = (c?: number | null) => fmtTemp(c, unit);
  const N = (c?: number | null) => convTemp(c, unit);
  const { data, pastDays: t, fetchedAt } = entry;
  const c = data.current.v;
  const dv = data.daily.v;
  const hv = data.hourly.v;
  const h0 = nowIndex(data);
  const today = data.daily.time[t];
  const normals = st.normals[city.id] ?? {};
  const log = st.history[city.id] ?? {};
  const normalOf = (date: string) => N(normals[date.slice(5)]);
  const hiToday = dv.temperature_2m_max[t];
  const avgToday = normals[today.slice(5)];

  // Past (the user's own log), today and the forecast on one axis.
  const days: Day[] = [];
  for (let k = 7; k >= 1; k--) {
    const date = addDays(today, -k);
    const rec = log[date];
    days.push({ label: weekday(date).slice(0, 2), hi: N(rec?.hi), lo: N(rec?.lo), normal: normalOf(date), kind: 'past' });
  }
  for (let k = 0; k <= 6 && t + k < data.daily.time.length; k++) {
    const date = data.daily.time[t + k];
    days.push({
      label: weekday(date).slice(0, 2),
      hi: N(dv.temperature_2m_max[t + k]), lo: N(dv.temperature_2m_min[t + k]),
      normal: normalOf(date), kind: k === 0 ? 'today' : 'future',
    });
  }

  // On this day: today against the 1991–2020 average and earlier years.
  const rows: Row[] = [{ label: 'Today', v: N(hiToday), text: `${T(hiToday)}°`, kind: 'today' }];
  if (avgToday != null) rows.push({ label: 'Average', v: N(avgToday), text: `${T(avgToday)}°`, kind: 'avg' });
  for (const y of st.thisDay[`${city.id}:${today.slice(5)}`] ?? []) {
    if (!y.error && y.hi != null) rows.push({ label: String(y.year), v: N(y.hi), text: `${T(y.hi)}°`, kind: 'year' });
  }

  // Next 2 hours in 15-minute steps; without nowcast data, the chance of rain per hour.
  const mq = data.minutely15;
  let rain: WidgetSnapshot['rain'];
  if (mq && mq.precipitation.length) {
    const max = Math.max(0.5, ...mq.precipitation.map((v) => v ?? 0));
    rain = {
      text: rainOutlook(data, h0),
      bars: mq.precipitation.map((v) => ({ f: (v ?? 0) / max, wet: (v ?? 0) >= 0.1 })),
      from: hhmm(mq.time[0]), to: hhmm(mq.time[mq.time.length - 1]), caption: 'mm per 15 min',
    };
  } else {
    const end = Math.min(h0 + 12, data.hourly.time.length);
    const p = hv.precipitation_probability.slice(h0, end).map((v) => v ?? 0);
    rain = {
      text: rainOutlook(data, h0),
      bars: p.map((v) => ({ f: v / 100, wet: v >= 50 })),
      from: hhmm(data.hourly.time[h0]), to: hhmm(data.hourly.time[end - 1]), caption: '% chance per hour',
    };
  }

  const hours = data.hourly.time.slice(h0, h0 + 12).map((time, k) => {
    const i = h0 + k;
    return {
      label: k === 0 ? 'Now' : hourOf(time) === '00' ? weekday(time.slice(0, 10)) : hourOf(time),
      temp: `${T(k === 0 ? c.temperature_2m : hv.temperature_2m[i])}°`,
      p: hv.precipitation_probability[i] ?? 0,
    };
  });

  const delta = hiToday != null && avgToday != null ? fmtDelta(hiToday - avgToday, unit) : null;
  return {
    v: 1,
    city: city.name,
    updated: new Date(fetchedAt).toTimeString().slice(0, 5),
    now: {
      temp: `${T(c.temperature_2m)}°`,
      cond: conditionLabel(c.weather_code),
      hi: `${T(hiToday)}°`,
      lo: `${T(dv.temperature_2m_min[t])}°`,
      rain: `${dv.precipitation_probability_max[t] ?? 0}%`,
      delta: delta ? `${delta} vs average` : null,
    },
    timeline: { days, todayHi: `${T(hiToday)}°` },
    thisDay: { date: shortDate(today), rows },
    rain,
    hours,
  };
}

let last = '';
let timer: number | undefined;

/** Keeps the widgets in step with the store (Android only). Returns an unsubscribe function. */
export function startWidgetSync(): () => void {
  if (Capacitor.getPlatform() !== 'android') return () => undefined;
  const push = () => {
    const st = useWeatherStore.getState();
    const city = st.cities[0];
    const entry = city && st.forecasts[city.id];
    // Past years for "On this day" (cached per date, like the History screen).
    if (city && entry) void st.loadThisDay(city.id, entry.data.daily.time[entry.pastDays]);
    const snap = buildSnapshot(st);
    const json = snap ? JSON.stringify(snap) : '';
    if (json === last) return;
    last = json;
    Widgets.update({ json }).catch(() => {
      // Older native build without widgets.
    });
  };
  push();
  const unsub = useWeatherStore.subscribe(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(push, 800);
  });
  return () => { unsub(); window.clearTimeout(timer); };
}
