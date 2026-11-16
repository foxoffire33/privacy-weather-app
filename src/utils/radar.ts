import { t } from '../i18n';
import { levelOf, rainRate } from '../stores';

import { fmtNumber, zonedEpoch } from './format';

import type { ForecastData, RadarFrame } from '../stores';
import type { ModelPoint, TimelineFrame } from '../types';

const NEAR = 6;
const LEVEL_LABEL = [() => t('radar.dry'), () => t('radar.light'), () => t('radar.moderate'), () => t('radar.heavy')] as const;
const FIVE_MIN = 5 * 60;
const HORIZON = 3 * 60 * 60;
const QUARTERS = 4;
const LIGHT_MM = 0.1;
const MODERATE_MM = 2.5;
const HEAVY_MM = 10;

function modelPoints(forecast: ForecastData): ModelPoint[] {
  const quarter = forecast.minutely15;
  const quarters = (quarter?.time ?? []).map((iso, i): ModelPoint => (
    { time: zonedEpoch(iso, forecast.timezone), mmPerHour: (quarter?.precipitation[i] ?? 0) * QUARTERS }
  ));
  const end = quarters.at(-1)?.time ?? 0;
  const rain = forecast.hourly.v.precipitation;
  const hours = forecast.hourly.time.map((iso, i): ModelPoint => ({ time: zonedEpoch(iso, forecast.timezone), mmPerHour: rain[i] ?? 0 }));
  return [...quarters, ...hours.filter((p) => p.time > end)];
}

export function buildTimeline(frames: readonly RadarFrame[], forecast: ForecastData, now: number): TimelineFrame[] {
  const radar = frames.map((frame): TimelineFrame => ({ time: frame.time, kind: frame.forecast ? 'nowcast' : 'radar', frame, mmPerHour: null }));
  const after = Math.max(now, frames.at(-1)?.time ?? now);
  const model = modelPoints(forecast)
    .filter((p) => p.time > after && p.time <= now + HORIZON)
    .map((p): TimelineFrame => ({ time: p.time, kind: 'model', frame: undefined, mmPerHour: p.mmPerHour }));
  return [...radar, ...model];
}

export function nowIndex(frames: readonly TimelineFrame[], now: number): number {
  let best = 0;
  for (const [i, f] of frames.entries()) {
    const current = frames.at(best);
    if (current !== undefined && f.time <= now && Math.abs(f.time - now) < Math.abs(current.time - now)) { best = i; }
  }
  return best;
}

export function selectedIndex(frames: readonly TimelineFrame[], time: number | null, now: number): number {
  if (time === null) { return nowIndex(frames, now); }
  const found = frames.findIndex((f) => f.time === time);
  return found === -1 ? nowIndex(frames, now) : found;
}

export function modelLevel(mmPerHour: number): number {
  if (mmPerHour < LIGHT_MM) { return 0; }
  if (mmPerHour < MODERATE_MM) { return 1; }
  return mmPerHour < HEAVY_MM ? 2 : 3;
}

export function rainNear(frame: TimelineFrame, cols: number, rows: number): number {
  if (frame.frame === undefined) { return modelLevel(frame.mmPerHour ?? 0) * 40; }
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  let sum = 0;
  for (let y = Math.max(0, cy - NEAR); y <= Math.min(rows - 1, cy + NEAR); y += 1) {
    for (let x = Math.max(0, cx - NEAR); x <= Math.min(cols - 1, cx + NEAR); x += 1) {
      sum += Number(frame.frame.cells[y * cols + x] ?? '0');
    }
  }
  return sum;
}

export function relativeTime(frameTime: number, nowTime: number): string {
  const minutes = Math.round((frameTime - nowTime) / FIVE_MIN) * 5;
  if (minutes === 0) { return t('radar.now'); }
  const total = Math.abs(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) { return minutes > 0 ? t('radar.inMin', { n: m }) : t('radar.agoMin', { n: m }); }
  if (m === 0) { return minutes > 0 ? t('radar.inH', { h }) : t('radar.agoH', { h }); }
  return minutes > 0 ? t('radar.inHm', { h, m }) : t('radar.agoHm', { h, m });
}

export function rainLabel(entry: TimelineFrame): string {
  if (entry.frame === undefined) {
    const mm = entry.mmPerHour ?? 0;
    const level = modelLevel(mm);
    return level === 0 ? t('radar.dry') : `${LEVEL_LABEL[level]()} · ${t('radar.rate', { mm: fmtNumber(mm, 1, 1) })}`;
  }
  const { cityDbz, citySnow } = entry.frame;
  const level = levelOf(cityDbz);
  if (level === 0 || cityDbz === null) { return t('radar.dry'); }
  const kind = citySnow ? t('radar.snow') : LEVEL_LABEL[level]();
  return `${kind} · ${t('radar.rate', { mm: fmtNumber(rainRate(cityDbz), 1, 1) })}`;
}

export function isWet(entry: TimelineFrame): boolean {
  if (entry.frame === undefined) { return modelLevel(entry.mmPerHour ?? 0) > 0; }
  return levelOf(entry.frame.cityDbz) > 0;
}
