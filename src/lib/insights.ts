import type { ForecastData } from '../types';
import { hhmm } from './format';
import { t, tl } from '../i18n';

// Plain-language readings derived from raw API values.

/** Names of the European AQI levels, in the current language. */
export const levelName = (i: number) => tl('levels.aqi')[i];

const band = (v: number, edges: number[]) => { const i = edges.findIndex((e) => v <= e); return i === -1 ? edges.length : i; };

export function euAqiLevel(a: number | null) { return a == null ? null : band(a, [20, 40, 60, 80, 100]); }

export function usAqiLabel(a: number | null) {
  if (a == null) return t('levels.usAqi.unavailable');
  return t(a <= 50 ? 'levels.usAqi.good' : a <= 100 ? 'levels.usAqi.moderate' : a <= 150 ? 'levels.usAqi.sensitive' : a <= 200 ? 'levels.usAqi.unhealthy' : a <= 300 ? 'levels.usAqi.veryUnhealthy' : 'levels.usAqi.hazardous');
}

// European AQI sub-index bands, µg/m³.
const POLLUTANT_BANDS: Record<string, number[]> = {
  pm2_5: [10, 20, 25, 50, 75],
  pm10: [20, 40, 50, 100, 150],
  nitrogen_dioxide: [40, 90, 120, 230, 340],
  ozone: [50, 100, 130, 240, 380],
  sulphur_dioxide: [100, 200, 350, 500, 750],
};
export function pollutantLevel(key: string, v: number | null) {
  const edges = POLLUTANT_BANDS[key];
  return v == null || !edges ? null : band(v, edges);
}

export function pollenLevel(v: number | null) {
  if (v == null) return null;
  const level = band(v, [0.5, 10, 50, 200]);
  return { level, label: tl('levels.pollen')[level] };
}

export function beaufort(kmh: number | null) {
  if (kmh == null) return '–';
  return tl('levels.beaufort')[band(kmh, [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117])];
}

export function feelsLabel(c: number | null) {
  if (c == null) return '–';
  return t(c < -10 ? 'levels.feels.dangerouslyCold' : c < 0 ? 'levels.feels.freezing' : c < 10 ? 'levels.feels.cold' : c < 18 ? 'levels.feels.cool' : c < 24 ? 'levels.feels.comfortable' : c < 29 ? 'levels.feels.warm' : c < 35 ? 'levels.feels.hot' : 'levels.feels.veryHot');
}

export function dewLabel(dp: number | null) {
  if (dp == null) return '–';
  return t(dp < 10 ? 'levels.dew.dry' : dp < 16 ? 'levels.dew.comfortable' : dp < 21 ? 'levels.dew.humid' : 'levels.dew.oppressive');
}

export function uvAdvice(u: number | null) {
  if (u == null) return '–';
  return t(u < 3 ? 'levels.uv.none' : u < 6 ? 'levels.uv.midday' : u < 8 ? 'levels.uv.shade' : 'levels.uv.avoid');
}

export function capeLabel(j: number | null) {
  if (j == null) return '–';
  return t(j < 300 ? 'levels.cape.low' : j < 1000 ? 'levels.cape.moderate' : j < 2500 ? 'levels.cape.high' : 'levels.cape.extreme');
}

export function visibilityLabel(m: number | null) {
  if (m == null) return '–';
  return t(m < 1000 ? 'levels.visibility.fog' : m < 4000 ? 'levels.visibility.mist' : m < 10000 ? 'levels.visibility.moderate' : 'levels.visibility.clear');
}

export function duration(sec: number | null) {
  if (sec == null) return '–';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? t('units.hoursMinutes', { h, m }) : t('units.minutes', { m });
}

export function signedMinutes(sec: number) {
  const m = Math.round(sec / 60);
  return `${m >= 0 ? '+' : '−'}${t('units.minutes', { m: Math.abs(m) })}`;
}

// Index of the current hour in the hourly arrays.
export function nowIndex(data: ForecastData) {
  const floor = data.current.time.slice(0, 13) + ':00';
  return Math.max(0, data.hourly.time.findIndex((x) => x >= floor));
}

export function rainOutlook(data: ForecastData, h0: number) {
  const word = t((data.current.v.temperature_2m ?? 5) < 1 ? 'rain.snow' : 'rain.rain');
  const m = data.minutely15;
  if (m && m.precipitation.length) {
    const wet = m.precipitation.map((v) => (v ?? 0) >= 0.1);
    if (wet[0]) {
      const stop = wet.indexOf(false);
      return stop === -1 ? t('rain.continuing', { word }) : t('rain.stopping', { word, time: hhmm(m.time[stop]) });
    }
    const start = wet.indexOf(true);
    if (start > 0) return t('rain.starting', { word, time: hhmm(m.time[start]) });
  }
  const p = data.hourly.v.precipitation_probability;
  for (let i = h0 + 1; i < h0 + 12 && i < p.length; i++) {
    if ((p[i] ?? 0) >= 50) return t('rain.likely', { word, time: hhmm(data.hourly.time[i]), p: p[i] });
  }
  return t('rain.none');
}

export function pressureTrend(data: ForecastData, h0: number) {
  const p = data.hourly.v.pressure_msl;
  const now = p[h0];
  const before = p[Math.max(0, h0 - 3)];
  if (now == null || before == null) return null;
  const d = now - before;
  return { delta: d, label: t(d > 1 ? 'levels.pressure.rising' : d < -1 ? 'levels.pressure.falling' : 'levels.pressure.steady') };
}

// 0–1 position of "now" between sunrise and sunset, or null at night.
export function sunProgress(nowIso: string, sunrise?: string, sunset?: string) {
  if (!sunrise || !sunset) return null;
  const t = (s: string) => new Date(s + 'Z').getTime();
  const p = (t(nowIso) - t(sunrise)) / (t(sunset) - t(sunrise));
  return p < 0 || p > 1 ? null : p;
}
