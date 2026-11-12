import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { TempUnit, WindUnit } from '../types';

// Stored data is always metric (°C, km/h, mm); units apply only when formatting.
export function fmtTemp(c: number | null | undefined, unit: TempUnit): string {
  if (c == null || Number.isNaN(c)) return '–';
  return String(Math.round(unit === 'F' ? c * 9 / 5 + 32 : c));
}
export function fmtDelta(d: number | null | undefined, unit: TempUnit): string | null {
  if (d == null || Number.isNaN(d)) return null;
  const v = unit === 'F' ? d * 9 / 5 : d;
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '°';
}
export function fmtWind(kmh: number | null | undefined, unit: WindUnit): string {
  if (kmh == null) return '–';
  if (unit === 'ms') return (kmh / 3.6).toFixed(1) + ' m/s';
  if (unit === 'mph') return Math.round(kmh / 1.609) + ' mph';
  return Math.round(kmh) + ' km/h';
}
export const hhmm = (iso?: string) => (iso ? iso.slice(11, 16) : '–');
export const hourOf = (iso: string) => iso.slice(11, 13);
export const weekday = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short' });
export const shortDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const longDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const compass = (deg?: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((deg ?? 0) / 45) % 8];

export function ago(ts?: number): string {
  if (!ts) return 'never';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
export function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00Z').getTime() - new Date(a + 'T12:00Z').getTime()) / 86400000);

export function uvLabel(u?: number | null): string {
  if (u == null) return '–';
  return u < 3 ? 'Low' : u < 6 ? 'Moderate' : u < 8 ? 'High' : u < 11 ? 'Very high' : 'Extreme';
}
export function aqiLabel(a?: number | null): string {
  if (a == null) return 'Unavailable';
  return a <= 20 ? 'Good' : a <= 40 ? 'Fair' : a <= 60 ? 'Moderate' : a <= 80 ? 'Poor' : a <= 100 ? 'Very poor' : 'Extremely poor';
}
// Browsers download via a link. The Android WebView ignores that for blobs, so the app writes the file to
// its cache and hands it to the system share sheet (save to Files, Drive, mail, ...).
export async function downloadFile(name: string, text: string, type: string) {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: uri, dialogTitle: 'Save or share' }).catch(() => undefined); // closing the sheet is not an error
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Numeric conversions for charts.
export const convTemp = (c: number | null | undefined, unit: TempUnit) =>
  (c == null || Number.isNaN(c) ? null : Math.round((unit === 'F' ? c * 9 / 5 + 32 : c) * 10) / 10);
export const convWind = (kmh: number | null | undefined, unit: WindUnit) =>
  (kmh == null ? null : Math.round((unit === 'ms' ? kmh / 3.6 : unit === 'mph' ? kmh / 1.609 : kmh) * 10) / 10);
export const windUnitLabel = (unit: WindUnit) => (unit === 'ms' ? 'm/s' : unit === 'mph' ? 'mph' : 'km/h');
export const fullDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
