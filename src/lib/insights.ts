import type { ForecastData } from '../types';
import { hhmm } from './format';

// Plain-language readings derived from raw API values.

export const LEVELS = ['Good', 'Fair', 'Moderate', 'Poor', 'Very poor', 'Extremely poor'] as const;

const band = (v: number, edges: number[]) => { const i = edges.findIndex((e) => v <= e); return i === -1 ? edges.length : i; };

export function euAqiLevel(a: number | null) { return a == null ? null : band(a, [20, 40, 60, 80, 100]); }

export function usAqiLabel(a: number | null) {
  if (a == null) return 'Unavailable';
  return a <= 50 ? 'Good' : a <= 100 ? 'Moderate' : a <= 150 ? 'Unhealthy for sensitive groups' : a <= 200 ? 'Unhealthy' : a <= 300 ? 'Very unhealthy' : 'Hazardous';
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
  return { level, label: ['None', 'Low', 'Moderate', 'High', 'Very high'][level] };
}

export function beaufort(kmh: number | null) {
  if (kmh == null) return '–';
  const names = ['Calm', 'Light air', 'Light breeze', 'Gentle breeze', 'Moderate breeze', 'Fresh breeze', 'Strong breeze', 'Near gale', 'Gale', 'Strong gale', 'Storm', 'Violent storm', 'Hurricane force'];
  return names[band(kmh, [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117])];
}

export function feelsLabel(c: number | null) {
  if (c == null) return '–';
  return c < -10 ? 'Dangerously cold' : c < 0 ? 'Freezing' : c < 10 ? 'Cold' : c < 18 ? 'Cool' : c < 24 ? 'Comfortable' : c < 29 ? 'Warm' : c < 35 ? 'Hot' : 'Very hot';
}

export function dewLabel(dp: number | null) {
  if (dp == null) return '–';
  return dp < 10 ? 'Dry air' : dp < 16 ? 'Comfortable' : dp < 21 ? 'Humid' : 'Oppressive';
}

export function uvAdvice(u: number | null) {
  if (u == null) return '–';
  return u < 3 ? 'No protection needed' : u < 6 ? 'Sunscreen around midday' : u < 8 ? 'Seek shade 11:00–16:00' : 'Avoid the midday sun';
}

export function capeLabel(j: number | null) {
  if (j == null) return '–';
  return j < 300 ? 'Low' : j < 1000 ? 'Moderate' : j < 2500 ? 'High' : 'Extreme';
}

export function visibilityLabel(m: number | null) {
  if (m == null) return '–';
  return m < 1000 ? 'Fog' : m < 4000 ? 'Mist or haze' : m < 10000 ? 'Moderate' : 'Clear';
}

export function duration(sec: number | null) {
  if (sec == null) return '–';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function signedMinutes(sec: number) {
  const m = Math.round(sec / 60);
  return `${m >= 0 ? '+' : '−'}${Math.abs(m)} min`;
}

// Index of the current hour in the hourly arrays.
export function nowIndex(data: ForecastData) {
  const floor = data.current.time.slice(0, 13) + ':00';
  return Math.max(0, data.hourly.time.findIndex((x) => x >= floor));
}

export function rainOutlook(data: ForecastData, h0: number) {
  const word = (data.current.v.temperature_2m ?? 5) < 1 ? 'Snow' : 'Rain';
  const m = data.minutely15;
  if (m && m.precipitation.length) {
    const wet = m.precipitation.map((v) => (v ?? 0) >= 0.1);
    if (wet[0]) {
      const stop = wet.indexOf(false);
      return stop === -1 ? `${word} for at least the next 2 hours` : `${word} now, stopping around ${hhmm(m.time[stop])}`;
    }
    const start = wet.indexOf(true);
    if (start > 0) return `${word} starting around ${hhmm(m.time[start])}`;
  }
  const p = data.hourly.v.precipitation_probability;
  for (let i = h0 + 1; i < h0 + 12 && i < p.length; i++) {
    if ((p[i] ?? 0) >= 50) return `${word} likely from ${hhmm(data.hourly.time[i])} (${p[i]}%)`;
  }
  return 'No rain expected in the next 12 hours';
}

export function pressureTrend(data: ForecastData, h0: number) {
  const p = data.hourly.v.pressure_msl;
  const now = p[h0];
  const before = p[Math.max(0, h0 - 3)];
  if (now == null || before == null) return null;
  const d = now - before;
  return { delta: d, label: d > 1 ? 'Rising' : d < -1 ? 'Falling' : 'Steady' };
}

// 0–1 position of "now" between sunrise and sunset, or null at night.
export function sunProgress(nowIso: string, sunrise?: string, sunset?: string) {
  if (!sunrise || !sunset) return null;
  const t = (s: string) => new Date(s + 'Z').getTime();
  const p = (t(nowIso) - t(sunrise)) / (t(sunset) - t(sunrise));
  return p < 0 || p > 1 ? null : p;
}
