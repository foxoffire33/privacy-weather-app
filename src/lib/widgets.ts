import { Capacitor, registerPlugin } from '@capacitor/core';

import { t as tx, useI18n } from '../i18n';
import { followedCities, useAlmanacStore, useForecastStore, useLogStore, useSettingsStore, useEntityCache, addDays } from '../stores';

import { convTemp, fmtDelta, fmtTemp, hhmm, hourOf, shortDate, weekday } from './format';
import { nowIndex, rainOutlook } from './insights';
import { conditionLabel } from './weatherCodes';

import type { ArchiveYear, City, DayRecord, ForecastEntry, TempUnit } from '../stores';

interface WidgetsPlugin {
  update: (options: { json: string }) => Promise<void>;
}
const Widgets = registerPlugin<WidgetsPlugin>('Widgets');

interface Day { label: string; hi: number | null; lo: number | null; normal: number | null; kind: 'past' | 'today' | 'future' }
interface Row { label: string; v: number | null; text: string; kind: 'today' | 'avg' | 'year' }
interface RainBar { f: number; wet: boolean }

export interface WidgetSnapshot {
  v: 1;
  city: string;
  updated: string;
  now: { temp: string; cond: string; hi: string; lo: string; rain: string; rainLabel: string; delta: string | null };
  labels: { past7: string; forecast: string; average: string; onThisDay: string; earlierYears: string };
  timeline: { days: Day[]; todayHi: string };
  thisDay: { date: string; rows: Row[] };
  rain: { text: string; bars: RainBar[]; from: string; to: string; caption: string };
  hours: { label: string; temp: string; p: number }[];
}

export interface SnapshotInput {
  city: City | undefined;
  entry: ForecastEntry | undefined;
  tempUnit: TempUnit;
  normals: Record<string, number>;
  log: Record<string, DayRecord>;
  years: ArchiveYear[];
}

export function buildSnapshot(input: SnapshotInput): WidgetSnapshot | null {
  const { city, entry } = input;
  if (!city || !entry) {return null;}
  const unit = input.tempUnit;
  const T = (c?: number | null) => fmtTemp(c, unit);
  const N = (c?: number | null) => convTemp(c, unit);
  const { data, pastDays: t, fetchedAt } = entry;
  const c = data.current.v;
  const dv = data.daily.v;
  const hv = data.hourly.v;
  const h0 = nowIndex(data);
  const today = data.daily.time[t];
  const { normals, log } = input;
  const normalOf = (date: string) => N(normals[date.slice(5)]);
  const hiToday = dv.temperature_2m_max[t];
  const avgToday = normals[today.slice(5)];
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

  const rows: Row[] = [{ label: tx('common.today'), v: N(hiToday), text: `${T(hiToday)}°`, kind: 'today' }];
  if (avgToday != null) {rows.push({ label: tx('widgets.average_row'), v: N(avgToday), text: `${T(avgToday)}°`, kind: 'avg' });}
  for (const y of input.years) {
    if (!y.error && y.hi != null) {rows.push({ label: String(y.year), v: N(y.hi), text: `${T(y.hi)}°`, kind: 'year' });}
  }

  const mq = data.minutely15;
  let rain: WidgetSnapshot['rain'];
  if (mq && mq.precipitation.length > 0) {
    const max = Math.max(0.5, ...mq.precipitation.map((v) => v ?? 0));
    rain = {
      text: rainOutlook(data, h0),
      bars: mq.precipitation.map((v) => ({ f: (v ?? 0) / max, wet: (v ?? 0) >= 0.1 })),
      from: hhmm(mq.time[0]), to: hhmm(mq.time.at(-1)), caption: tx('widgets.mmPer15'),
    };
  } else {
    const end = Math.min(h0 + 12, data.hourly.time.length);
    const p = hv.precipitation_probability.slice(h0, end).map((v) => v ?? 0);
    rain = {
      text: rainOutlook(data, h0),
      bars: p.map((v) => ({ f: v / 100, wet: v >= 50 })),
      from: hhmm(data.hourly.time[h0]), to: hhmm(data.hourly.time[end - 1]), caption: tx('widgets.chancePerHour'),
    };
  }

  const hours = data.hourly.time.slice(h0, h0 + 12).map((time, k) => {
    const i = h0 + k;
    return {
      label: k === 0 ? tx('common.now') : (hourOf(time) === '00' ? weekday(time.slice(0, 10)) : hourOf(time)),
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
      rainLabel: tx('widgets.rainShort', { p: `${dv.precipitation_probability_max[t] ?? 0}%` }),
      delta: delta ? tx('city.vsAverage', { delta }) : null,
    },
    timeline: { days, todayHi: `${T(hiToday)}°` },
    thisDay: { date: shortDate(today), rows },
    rain,
    hours,
    labels: {
      past7: tx('widgets.past7'), forecast: tx('widgets.forecast'), average: tx('widgets.average'),
      onThisDay: tx('widgets.onThisDay'), earlierYears: tx('widgets.earlierYears'),
    },
  };
}

let last = '';
let timer: number | undefined;

export function startWidgetSync(): () => void {
  if (Capacitor.getPlatform() !== 'android') {return () => {};}
  const push = () => {
    const snap = buildSnapshot(readSnapshotInput());
    const json = snap ? JSON.stringify(snap) : '';
    if (json === last) {return;}
    last = json;
    Widgets.update({ json }).catch(() => {});
  };
  push();
  const later = () => {
    globalThis.clearTimeout(timer);
    timer = globalThis.setTimeout(push, 800);
  };
  const unsubs = [useEntityCache, useForecastStore, useLogStore, useAlmanacStore, useSettingsStore]
    .map((store) => store.subscribe(later));
  unsubs.push(useI18n.subscribe(later));
  return () => { for (const off of unsubs) {off();} globalThis.clearTimeout(timer); };
}

function readSnapshotInput(): SnapshotInput {
  const city = followedCities()[0];
  const settings = useSettingsStore.getState().settings;
  if (city === undefined) {return { city: undefined, entry: undefined, tempUnit: settings.tempUnit, normals: {}, log: {}, years: [] };}
  const entry = useForecastStore.getState().forecasts[city.id];
  const almanac = useAlmanacStore.getState();
  const today = entry ? entry.data.daily.time[entry.pastDays] : undefined;
  if (today !== undefined) {void almanac.ensureThisDay(city, today);}
  const dates = useLogStore.getState().dates[city.id] ?? [];
  const log: Record<string, DayRecord> = {};
  for (const record of useEntityCache.getState().getMany('dayRecord', dates.map((d) => `${city.id}:${d}`))) {
    log[record.date] = record;
  }

  return {
    city,
    entry,
    tempUnit: settings.tempUnit,
    normals: almanac.normals[city.id] ?? {},
    log,
    years: (today === undefined ? undefined : almanac.thisDay[`${city.id}:${today.slice(5)}`]) ?? [],
  };
}
