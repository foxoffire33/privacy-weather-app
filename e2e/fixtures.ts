import type { Page } from '@playwright/test';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const NOW_SEC = Math.floor(Date.now() / 1000);
const RADAR_MAPS = JSON.stringify({
  radar: {
    past: [
      { time: NOW_SEC - 1800, path: '/frames/frame-a' },
      { time: NOW_SEC - 1860, path: '/frames/frame-b' },
    ],
  },
});

const GEO = JSON.stringify({
  results: [{ id: 3_061_865, name: 'Paris', latitude: 48.8534, longitude: 2.3488, elevation: 35, admin1: 'Ile-de-France', country: 'France' }],
});

export function geoBody(): string {
  return GEO;
}

const SPECIAL = new Map<string, number>([
  ['temperature_2m', 12.5],
  ['apparent_temperature', 11.2],
  ['weather_code', 1],
  ['temperature_2m_max', 15.2],
  ['temperature_2m_min', 8.1],
  ['pressure_msl', 1013],
  ['precipitation', 0],
]);

function cellFor(varName: string, time: string): number | string {
  if (varName === 'sunrise') { return `${time.slice(0, 10)}T07:30`; }
  if (varName === 'sunset') { return `${time.slice(0, 10)}T16:45`; }
  if (varName === 'is_day') { return 1; }
  const special = SPECIAL.get(varName);
  return special ?? 1;
}

function block(time: string[], vars: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { time };
  for (const v of vars) { out[v] = time.map((t) => cellFor(v, t)); }
  return out;
}

function isoDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days.length > 0 ? days : [start];
}

function hoursFor(days: string[]): string[] {
  const hours: string[] = [];
  for (const d of days) {
    for (let h = 0; h < 24; h += 1) { hours.push(`${d}T${String(h).padStart(2, '0')}:00`); }
  }
  return hours;
}

function varsFor(params: URLSearchParams, name: string): string[] {
  return (params.get(name) ?? '').split(',').filter((v) => v !== '');
}

function shiftDay(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weatherJson(url: string): string {
  const params = new URL(url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const forecastDays = Number(params.get('forecast_days') ?? 1);
  const pastDays = Number(params.get('past_days') ?? 0);
  const start = params.get('start_date') ?? shiftDay(today, -pastDays);
  const end = params.get('end_date') ?? shiftDay(today, forecastDays - 1);
  const days = isoDays(start, end);
  const current: Record<string, unknown> = { time: `${days[0]}T12:00` };
  for (const v of varsFor(params, 'current')) { current[v] = cellFor(v, `${days[0]}T12:00`); }
  const out: Record<string, unknown> = { utc_offset_seconds: 0, timezone: 'UTC', current };
  const minuteCount = Number(params.get('forecast_minutely_15') ?? 0);
  if (minuteCount > 0) {
    const base = new Date(`${days[0]}T12:00:00Z`).getTime();
    const times = Array.from({ length: minuteCount }, (_, i) => new Date(base + i * 900_000).toISOString().slice(0, 16));
    const minutes: Record<string, unknown> = { time: times };
    for (const v of varsFor(params, 'minutely_15')) { minutes[v] = times.map(() => 0); }
    out.minutely_15 = minutes;
  }
  out.hourly = block(hoursFor(days), varsFor(params, 'hourly'));
  out.daily = block(days, varsFor(params, 'daily'));
  return JSON.stringify(out);
}

export interface RadarOptions {
  frames: boolean;
}

export async function installApi(page: Page, radar?: RadarOptions): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost:')) { await route.continue(); return; }
    if (url.includes('geocoding-api.open-meteo.com') || url.includes('customer-geocoding-api.open-meteo.com')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: GEO });
      return;
    }
    if (url.includes('.open-meteo.com')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: weatherJson(url) });
      return;
    }
    if (url.includes('librewxr.net')) {
      if (radar?.frames !== true) { await route.abort(); return; }
      if (url.endsWith('/public/weather-maps.json')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: RADAR_MAPS });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
      return;
    }
    await route.abort();
  });
}

export async function followParis(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose your first city' }).click();
  await page.getByLabel('Search cities').fill('Paris');
  await page.getByRole('button', { name: 'Follow' }).first().click();
  await page.getByText('Paris').first().waitFor({ state: 'visible' });
}
