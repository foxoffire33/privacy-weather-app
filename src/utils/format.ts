import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { currentLocale, t } from '../i18n';


import type { TempUnit, WindUnit } from '../stores';
import type { DateStyle } from '../types';

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  weekday: { weekday: 'short' },
  short: { day: 'numeric', month: 'short' },
  long: { day: 'numeric', month: 'short', year: 'numeric' },
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
};

export function fmtTemp(c: number | null | undefined, unit: TempUnit): string {
  if ((c === null || c === undefined) || Number.isNaN(c)) {return '–';}
  return String(Math.round(unit === 'F' ? c * 9 / 5 + 32 : c));
}
export function fmtDelta(d: number | null | undefined, unit: TempUnit): string | null {
  if ((d === null || d === undefined) || Number.isNaN(d)) {return null;}
  const v = unit === 'F' ? d * 9 / 5 : d;
  return `${(v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1)  }°`;
}
export function fmtWind(kmh: number | null | undefined, unit: WindUnit): string {
  if (kmh === null || kmh === undefined) {return '–';}
  if (unit === 'ms') {return `${(kmh / 3.6).toFixed(1)  } m/s`;}
  if (unit === 'mph') {return `${String(Math.round(kmh / 1.609))  } mph`;}
  return `${String(Math.round(kmh))  } km/h`;
}
export const hhmm = (iso?: string): string => ((iso !== undefined && iso !== '') ? iso.slice(11, 16) : '–');
export const hourOf = (iso: string): string => iso.slice(11, 13);
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatDay(iso: string, style: DateStyle): string {
  const locale = currentLocale();
  const key = `${locale}|${style}`;
  let format = formatters.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, { ...DATE_STYLES[style], timeZone: 'UTC' });
    formatters.set(key, format);
  }
  return format.format(new Date(`${iso}T12:00Z`));
}

export const weekday = (iso: string): string => formatDay(iso, 'weekday');
export const shortDate = (iso: string): string => formatDay(iso, 'short');
export const longDate = (iso: string): string => formatDay(iso, 'long');
const WIND_DIVISOR: Record<WindUnit, number> = { kmh: 1, ms: 3.6, mph: 1.609 };
const WIND_LABEL: Record<WindUnit, string> = { kmh: 'km/h', ms: 'm/s', mph: 'mph' };
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const compass = (deg?: number): string => t(`compass.${POINTS[Math.round((deg ?? 0) / 45) % 8]}`);

export function ago(ts?: number): string {
  if ((ts === undefined || ts === 0)) {return t('ago.never');}
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 1) {return t('ago.justNow');}
  if (m < 60) {return t('ago.minutes', { n: m });}
  const h = Math.round(m / 60);
  return h < 24 ? t('ago.hours', { n: h }) : t('ago.days', { n: Math.round(h / 24) });
}

export async function downloadFile(name: string, text: string, type: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Promise.allSettled([Share.share({ title: name, url: uri, dialogTitle: 'Save or share' })]);
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
}

export const convTemp = (c: number | null | undefined, unit: TempUnit): number | null =>
  ((c === null || c === undefined) || Number.isNaN(c) ? null : Math.round((unit === 'F' ? c * 9 / 5 + 32 : c) * 10) / 10);
export const convWind = (kmh: number | null | undefined, unit: WindUnit): number | null =>
  ((kmh === null || kmh === undefined) ? null : Math.round(kmh / WIND_DIVISOR[unit] * 10) / 10);
export const tempToCelsius = (v: number, unit: TempUnit): number => (unit === 'F' ? (v - 32) * 5 / 9 : v);
export const windToKmh = (v: number, unit: WindUnit): number => v * WIND_DIVISOR[unit];
export const windUnitLabel = (unit: WindUnit): string => WIND_LABEL[unit];
export const fullDate = (iso: string): string => formatDay(iso, 'full');

export function orDash(v: number | null | undefined, show: (n: number) => string): string {
  return v === null || v === undefined ? '–' : show(v);
}

export function hourLabel(time: string): string {
  const hour = hourOf(time);
  return hour === '00' ? weekday(time.slice(0, 10)) : hour;
}
