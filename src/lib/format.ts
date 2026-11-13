import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { currentLocale, t } from '../i18n';

import type { TempUnit, WindUnit } from '../stores';

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
  if (unit === 'mph') {return `${Math.round(kmh / 1.609)  } mph`;}
  return `${Math.round(kmh)  } km/h`;
}
export const hhmm = (iso?: string): string => ((iso !== undefined && iso !== '') ? iso.slice(11, 16) : '–');
export const hourOf = (iso: string): string => iso.slice(11, 13);
export const weekday = (iso: string): string => new Date(`${iso  }T12:00`).toLocaleDateString(currentLocale(), { weekday: 'short' });
export const shortDate = (iso: string): string => new Date(`${iso  }T12:00`).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' });
export const longDate = (iso: string): string => new Date(`${iso  }T12:00`).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
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

export function uvLabel(u?: number | null): string {
  if (u === null || u === undefined) {return '–';}
  return u < 3 ? 'Low' : u < 6 ? 'Moderate' : u < 8 ? 'High' : u < 11 ? 'Very high' : 'Extreme';
}
export function aqiLabel(a?: number | null): string {
  if (a === null || a === undefined) {return 'Unavailable';}
  return a <= 20 ? 'Good' : a <= 40 ? 'Fair' : a <= 60 ? 'Moderate' : a <= 80 ? 'Poor' : a <= 100 ? 'Very poor' : 'Extremely poor';
}

export async function downloadFile(name: string, text: string, type: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: uri, dialogTitle: 'Save or share' }).catch(() => {});
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
  ((kmh === null || kmh === undefined) ? null : Math.round((unit === 'ms' ? kmh / 3.6 : (unit === 'mph' ? kmh / 1.609 : kmh)) * 10) / 10);
export const windUnitLabel = (unit: WindUnit): "mph" | "m/s" | "km/h" => (unit === 'ms' ? 'm/s' : (unit === 'mph' ? 'mph' : 'km/h'));
export const fullDate = (iso: string): string => new Date(`${iso  }T12:00`).toLocaleDateString(currentLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function orDash(v: number | null | undefined, show: (n: number) => string): string {
  return v === null || v === undefined ? '–' : show(v);
}
