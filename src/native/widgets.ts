import { Capacitor, registerPlugin } from '@capacitor/core';

import { t as tx, useI18n } from '../i18n';
import { followedCities, loadThisDay, useAlmanacStore, useForecastStore, useLogStore, useSettingsStore, useEntityCache, addDays } from '../stores';
import { fireAndForget } from '../utils/fireAndForget';
import { convTemp, fmtDelta, fmtTemp, hhmm, hourLabel, shortDate, weekday } from '../utils/format';
import { nowIndex, rainOutlook } from '../utils/insights';
import { conditionLabel } from '../utils/weatherCodes';

import type { DayRecord, ForecastData, ForecastEntry, TempUnit } from '../stores';
import type { SnapshotInput, WidgetDay, WidgetRow, WidgetSnapshot, WidgetsPlugin } from '../types';

const Widgets = registerPlugin<WidgetsPlugin>('Widgets');

function widgetDays(input: SnapshotInput, entry: ForecastEntry): WidgetDay[] {
  const N = (v?: number | null) => convTemp(v, input.tempUnit);
  const { data, pastDays: t } = entry;
  const dv = data.daily.v;
  const today = data.daily.time[t];
  const normalOf = (date: string) => N(input.normals[date.slice(5)]);
  const days: WidgetDay[] = [];
  for (let k = 7; k >= 1; k--) {
    const date = addDays(today, -k);
    const rec = input.log[date];
    days.push({ label: weekday(date).slice(0, 2), hi: N(rec?.hi), lo: N(rec?.lo), normal: normalOf(date), kind: 'past' });
  }
  for (const [k, date] of data.daily.time.slice(t, t + 7).entries()) {
    days.push({
      label: weekday(date).slice(0, 2),
      hi: N(dv.temperature_2m_max[t + k]), lo: N(dv.temperature_2m_min[t + k]),
      normal: normalOf(date), kind: k === 0 ? 'today' : 'future',
    });
  }
  return days;
}

function widgetRows(input: SnapshotInput, hiToday: number | null, avgToday: number | undefined): WidgetRow[] {
  const T = (v?: number | null) => fmtTemp(v, input.tempUnit);
  const N = (v?: number | null) => convTemp(v, input.tempUnit);
  const rows: WidgetRow[] = [{ label: tx('common.today'), v: N(hiToday), text: `${T(hiToday)}°`, kind: 'today' }];
  if (avgToday !== undefined) { rows.push({ label: tx('widgets.average_row'), v: N(avgToday), text: `${T(avgToday)}°`, kind: 'avg' }); }
  for (const y of input.years) {
    if (y.error !== true && y.hi !== undefined) { rows.push({ label: String(y.year), v: N(y.hi), text: `${T(y.hi)}°`, kind: 'year' }); }
  }
  return rows;
}

function widgetRain(data: ForecastData, h0: number): WidgetSnapshot['rain'] {
  const mq = data.minutely15;
  if (mq !== null && mq.precipitation.length > 0) {
    const max = Math.max(0.5, ...mq.precipitation.map((v) => v ?? 0));
    return {
      text: rainOutlook(data, h0),
      bars: mq.precipitation.map((v) => ({ f: (v ?? 0) / max, wet: (v ?? 0) >= 0.1 })),
      from: hhmm(mq.time[0]), to: hhmm(mq.time.at(-1)), caption: tx('widgets.mmPer15'),
    };
  }
  const end = Math.min(h0 + 12, data.hourly.time.length);
  const p = data.hourly.v.precipitation_probability.slice(h0, end).map((v) => v ?? 0);
  return {
    text: rainOutlook(data, h0),
    bars: p.map((v) => ({ f: v / 100, wet: v >= 50 })),
    from: hhmm(data.hourly.time[h0]), to: hhmm(data.hourly.time[end - 1]), caption: tx('widgets.chancePerHour'),
  };
}

function widgetHours(data: ForecastData, h0: number, unit: TempUnit): WidgetSnapshot['hours'] {
  const hv = data.hourly.v;
  return data.hourly.time.slice(h0, h0 + 12).map((time, k) => ({
    label: k === 0 ? tx('common.now') : hourLabel(time),
    temp: `${fmtTemp(k === 0 ? data.current.v.temperature_2m : hv.temperature_2m[h0 + k], unit)}°`,
    p: hv.precipitation_probability[h0 + k] ?? 0,
  }));
}

function buildSnapshot(input: SnapshotInput): WidgetSnapshot | null {
  const { city, entry } = input;
  if (!city || !entry) { return null; }
  const unit = input.tempUnit;
  const T = (v?: number | null) => fmtTemp(v, unit);
  const { data, pastDays: t, fetchedAt } = entry;
  const c = data.current.v;
  const dv = data.daily.v;
  const h0 = nowIndex(data);
  const today = data.daily.time[t];
  const hiToday = dv.temperature_2m_max[t];
  const avgToday = input.normals[today.slice(5)];
  const delta = hiToday !== null && avgToday !== undefined ? fmtDelta(hiToday - avgToday, unit) : null;
  const rainChance = `${String(dv.precipitation_probability_max[t] ?? 0)}%`;
  return {
    v: 1,
    city: city.name,
    updated: new Date(fetchedAt).toTimeString().slice(0, 5),
    now: {
      temp: `${T(c.temperature_2m)}°`,
      cond: conditionLabel(c.weather_code),
      hi: `${T(hiToday)}°`,
      lo: `${T(dv.temperature_2m_min[t])}°`,
      rain: rainChance,
      rainLabel: tx('widgets.rainShort', { p: rainChance }),
      delta: delta === null || delta === '' ? null : tx('city.vsAverage', { delta }),
    },
    timeline: { days: widgetDays(input, entry), todayHi: `${T(hiToday)}°` },
    thisDay: { date: shortDate(today), rows: widgetRows(input, hiToday, avgToday) },
    rain: widgetRain(data, h0),
    hours: widgetHours(data, h0, unit),
    labels: {
      past7: tx('widgets.past7'), forecast: tx('widgets.forecast'), average: tx('widgets.average'),
      onThisDay: tx('widgets.onThisDay'), earlierYears: tx('widgets.earlierYears'),
    },
  };
}

let last = '';
let timer: number | undefined;

function pushSnapshot(): void {
  const snap = buildSnapshot(readSnapshotInput());
  const json = snap ? JSON.stringify(snap) : '';
  if (json === last) { return; }
  last = json;
  fireAndForget(Widgets.update({ json }));
}

function pushLater(): void {
  globalThis.clearTimeout(timer);
  timer = globalThis.setTimeout(pushSnapshot, 800);
}

export function startWidgetSync(): (() => void) | undefined {
  if (Capacitor.getPlatform() !== 'android') { return undefined; }
  pushSnapshot();
  const later = pushLater;
  const unsubs = [useEntityCache, useForecastStore, useLogStore, useAlmanacStore, useSettingsStore]
    .map((store) => store.subscribe(later));
  unsubs.push(useI18n.subscribe(later));
  return () => { for (const off of unsubs) { off(); } globalThis.clearTimeout(timer); };
}

function readSnapshotInput(): SnapshotInput {
  const city = followedCities().at(0);
  const settings = useSettingsStore.getState().settings;
  if (city === undefined) {return { city: undefined, entry: undefined, tempUnit: settings.tempUnit, normals: {}, log: {}, years: [] };}
  const entry = useForecastStore.getState().forecasts[city.id];
  const almanac = useAlmanacStore.getState();
  const today = entry ? entry.data.daily.time[entry.pastDays] : undefined;
  if (today !== undefined) { void loadThisDay(city.id, today); }
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
