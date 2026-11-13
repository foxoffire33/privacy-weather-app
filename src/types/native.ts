import type { MantineColorsTuple } from '@mantine/core';
import type { Accent, ArchiveYear, City, DayRecord, ForecastEntry, TempUnit } from '../stores';

export interface AppIconOptions {
  accent: Accent;
  color: string;
}

export interface AppIconPlugin {
  setAccent(options: AppIconOptions): Promise<void>;
}

export interface WidgetsUpdate {
  json: string;
}

export interface WidgetsPlugin {
  update(options: WidgetsUpdate): Promise<void>;
}

export interface WidgetDay {
  label: string;
  hi: number | null;
  lo: number | null;
  normal: number | null;
  kind: 'past' | 'today' | 'future';
}

export interface WidgetRow {
  label: string;
  v: number | null;
  text: string;
  kind: 'today' | 'avg' | 'year';
}

export interface WidgetRainBar {
  f: number;
  wet: boolean;
}

export interface WidgetNow {
  temp: string;
  cond: string;
  hi: string;
  lo: string;
  rain: string;
  rainLabel: string;
  delta: string | null;
}

export interface WidgetLabels {
  past7: string;
  forecast: string;
  average: string;
  onThisDay: string;
  earlierYears: string;
}

export interface WidgetTimeline {
  days: WidgetDay[];
  todayHi: string;
}

export interface WidgetThisDay {
  date: string;
  rows: WidgetRow[];
}

export interface WidgetRain {
  text: string;
  bars: WidgetRainBar[];
  from: string;
  to: string;
  caption: string;
}

export interface WidgetHour {
  label: string;
  temp: string;
  p: number;
}

export interface WidgetSnapshot {
  v: 1;
  city: string;
  updated: string;
  now: WidgetNow;
  labels: WidgetLabels;
  timeline: WidgetTimeline;
  thisDay: WidgetThisDay;
  rain: WidgetRain;
  hours: WidgetHour[];
}

export interface SnapshotInput {
  city: City | undefined;
  entry: ForecastEntry | undefined;
  tempUnit: TempUnit;
  normals: Record<string, number>;
  log: Record<string, DayRecord>;
  years: ArchiveYear[];
}

export interface AccentDef {
  label: string;
  tuple: MantineColorsTuple;
}
