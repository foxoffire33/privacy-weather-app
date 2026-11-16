import { t } from '../i18n';
import { levelOf, rainRate } from '../stores';

import type { RadarFrame } from '../stores';

const NEAR = 6;
const LEVEL_LABEL = [() => t('radar.dry'), () => t('radar.light'), () => t('radar.moderate'), () => t('radar.heavy')] as const;
const FIVE_MIN = 5 * 60;

export function nowIndex(frames: readonly RadarFrame[]): number {
  const past = frames.findLastIndex((f) => !f.forecast);
  return past === -1 ? 0 : past;
}

export function selectedIndex(frames: readonly RadarFrame[], time: number | null): number {
  if (time === null) { return nowIndex(frames); }
  const found = frames.findIndex((f) => f.time === time);
  return found === -1 ? nowIndex(frames) : found;
}

export function rainNear(frame: RadarFrame, cols: number, rows: number): number {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  let sum = 0;
  for (let y = Math.max(0, cy - NEAR); y <= Math.min(rows - 1, cy + NEAR); y += 1) {
    for (let x = Math.max(0, cx - NEAR); x <= Math.min(cols - 1, cx + NEAR); x += 1) {
      sum += Number(frame.cells[y * cols + x] ?? '0');
    }
  }
  return sum;
}

export function relativeTime(frameTime: number, nowTime: number): string {
  const minutes = Math.round((frameTime - nowTime) / FIVE_MIN) * 5;
  if (minutes === 0) { return t('radar.now'); }
  return minutes > 0 ? t('radar.inMin', { n: minutes }) : t('radar.agoMin', { n: -minutes });
}

export function hoursLabel(frameTime: number, nowTime: number): string {
  const hours = Math.round((frameTime - nowTime) / 360) / 10;
  if (hours === 0) { return t('radar.now'); }
  return t('radar.hours', { n: `${hours > 0 ? '+' : '−'}${String(Math.abs(hours))}` });
}

export function rainLabel(frame: RadarFrame): string {
  const level = levelOf(frame.cityDbz);
  if (level === 0 || frame.cityDbz === null) { return t('radar.dry'); }
  const kind = frame.citySnow ? t('radar.snow') : LEVEL_LABEL[level]();
  return `${kind} · ${t('radar.rate', { mm: rainRate(frame.cityDbz).toFixed(1) })}`;
}
