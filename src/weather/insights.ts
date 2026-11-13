import { t, tl } from '../i18n';
import { hhmm } from '../utils/format';
import { atMost, below } from '../utils/scale';

import type { ForecastData } from '../stores';
import type { MessageKey, PollenLevel, PressureTrend } from '../types';

export const levelName = (i: number): string => tl('levels.aqi')[i];

const band = (v: number, edges: number[]) => { const i = edges.findIndex((e) => v <= e); return i === -1 ? edges.length : i; };

export function euAqiLevel(a: number | null): number | null { return a === null ? null : band(a, [20, 40, 60, 80, 100]); }

export function usAqiLabel(a: number | null): string {
  if (a === null) {return t('levels.usAqi.unavailable');}
  return t(atMost(a, [[50, 'levels.usAqi.good'], [100, 'levels.usAqi.moderate'], [150, 'levels.usAqi.sensitive'], [200, 'levels.usAqi.unhealthy'], [300, 'levels.usAqi.veryUnhealthy']], 'levels.usAqi.hazardous'));
}

const POLLUTANT_BANDS: Partial<Record<string, number[]>> = {
  pm2_5: [10, 20, 25, 50, 75],
  pm10: [20, 40, 50, 100, 150],
  nitrogen_dioxide: [40, 90, 120, 230, 340],
  ozone: [50, 100, 130, 240, 380],
  sulphur_dioxide: [100, 200, 350, 500, 750],
};
export function pollutantLevel(key: string, v: number | null): number | null {
  const edges = POLLUTANT_BANDS[key];
  return v === null || edges === undefined ? null : band(v, edges);
}

export function pollenLevel(v: number | null): PollenLevel | null {
  if (v === null) {return null;}
  const level = band(v, [0.5, 10, 50, 200]);
  return { level, label: tl('levels.pollen')[level] };
}

export function beaufort(kmh: number | null): string {
  if (kmh === null) {return '–';}
  return tl('levels.beaufort')[band(kmh, [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117])];
}

export function feelsLabel(c: number | null): string {
  if (c === null) {return '–';}
  return t(below(c, [[-10, 'levels.feels.dangerouslyCold'], [0, 'levels.feels.freezing'], [10, 'levels.feels.cold'], [18, 'levels.feels.cool'], [24, 'levels.feels.comfortable'], [29, 'levels.feels.warm'], [35, 'levels.feels.hot']], 'levels.feels.veryHot'));
}

export function dewLabel(dp: number | null): string {
  if (dp === null) {return '–';}
  return t(below(dp, [[10, 'levels.dew.dry'], [16, 'levels.dew.comfortable'], [21, 'levels.dew.humid']], 'levels.dew.oppressive'));
}

export function uvAdvice(u: number | null): string {
  if (u === null) {return '–';}
  return t(below(u, [[3, 'levels.uv.none'], [6, 'levels.uv.midday'], [8, 'levels.uv.shade']], 'levels.uv.avoid'));
}

export function capeLabel(j: number | null): string {
  if (j === null) {return '–';}
  return t(below(j, [[300, 'levels.cape.low'], [1000, 'levels.cape.moderate'], [2500, 'levels.cape.high']], 'levels.cape.extreme'));
}

export function visibilityLabel(m: number | null): string {
  if (m === null) {return '–';}
  return t(below(m, [[1000, 'levels.visibility.fog'], [4000, 'levels.visibility.mist'], [10_000, 'levels.visibility.moderate']], 'levels.visibility.clear'));
}

export function duration(sec: number | null): string {
  if (sec === null) {return '–';}
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h === 0 ? t('units.minutes', { m }) : t('units.hoursMinutes', { h, m });
}

export function signedMinutes(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m >= 0 ? '+' : '−'}${t('units.minutes', { m: Math.abs(m) })}`;
}

export function nowIndex(data: ForecastData): number {
  const floor = `${data.current.time.slice(0, 13)  }:00`;
  return Math.max(0, data.hourly.time.findIndex((x) => x >= floor));
}

export function rainOutlook(data: ForecastData, h0: number): string {
  const word = t((data.current.v.temperature_2m ?? 5) < 1 ? 'rain.snow' : 'rain.rain');
  const m = data.minutely15;
  if (m && m.precipitation.length > 0) {
    const wet = m.precipitation.map((v) => (v ?? 0) >= 0.1);
    if (wet[0]) {
      const stop = wet.indexOf(false);
      return stop === -1 ? t('rain.continuing', { word }) : t('rain.stopping', { word, time: hhmm(m.time[stop]) });
    }
    const start = wet.indexOf(true);
    if (start > 0) {return t('rain.starting', { word, time: hhmm(m.time[start]) });}
  }
  const p = data.hourly.v.precipitation_probability;
  for (let i = h0 + 1; i < h0 + 12 && i < p.length; i++) {
    if ((p[i] ?? 0) >= 50) {return t('rain.likely', { word, time: hhmm(data.hourly.time[i]), p: p[i] });}
  }
  return t('rain.none');
}

function pressureKey(d: number): MessageKey {
  if (d > 1) { return 'levels.pressure.rising'; }
  if (d < -1) { return 'levels.pressure.falling'; }
  return 'levels.pressure.steady';
}

export function pressureTrend(data: ForecastData, h0: number): PressureTrend | null {
  const p = data.hourly.v.pressure_msl;
  const now = p[h0];
  const before = p[Math.max(0, h0 - 3)];
  if (now === null || before === null) {return null;}
  const d = now - before;
  return { delta: d, label: t(pressureKey(d)) };
}

const utcMs = (iso: string) => new Date(`${iso}Z`).getTime();

export function sunProgress(nowIso: string, sunrise?: string, sunset?: string): number | null {
  if ((sunrise === undefined || sunrise === '') || (sunset === undefined || sunset === '')) {return null;}
  const p = (utcMs(nowIso) - utcMs(sunrise)) / (utcMs(sunset) - utcMs(sunrise));
  return p < 0 || p > 1 ? null : p;
}
