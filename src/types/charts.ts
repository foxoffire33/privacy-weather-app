import type { DayRecord, HourlyVar, TempUnit, WindUnit } from '../stores';
import type { SeriesToggleApi } from './hooks';
import type { MessageKey } from './i18n';
import type { DateRange } from './stores';
import type { TooltipContentProps, TooltipPayloadEntry } from 'recharts';

export interface ToggleSeries {
  name: string;
  label?: string;
  color: string;
}

export interface Named {
  name: string;
}

export interface Labelled {
  label: MessageKey;
}

export type TooltipEntry = TooltipPayloadEntry;

export type CompactTooltipProps = Pick<TooltipContentProps, 'active' | 'label' | 'payload'>;

export type HourlySeries = Partial<Record<HourlyVar, (number | null)[]>>;

export interface HourlyMetric {
  value: string;
  label: MessageKey;
  needs: HourlyVar | 'aqi';
}

export interface HourlyExplorerProps {
  time: string[];
  v: HourlySeries;
  aqi?: Record<string, number | null>;
  from?: number;
  to?: number;
  height?: number | string;
}

export type TrendGroup = 'temp' | 'rain' | 'snow' | 'wind' | 'sun' | 'uv';

export interface TrendUnits {
  temp: TempUnit;
  wind: WindUnit;
}

export interface TrendAttr {
  key: string;
  label: MessageKey;
  group: TrendGroup;
  value: (r: DayRecord | undefined, normal: number | null, units: TrendUnits) => number | null;
}

export interface TrendGroupDef {
  key: TrendGroup;
  title: MessageKey;
  bars?: boolean;
}

export interface GroupChartSeries {
  name: string;
  color: string;
}

export interface GroupChartProps {
  id: string;
  group: TrendGroupDef;
  series: GroupChartSeries[];
  data: Record<string, string | number | null>[];
  base: { dataKey: string; xAxisProps: { interval: number } };
  unit: string;
}

export type HourlyRow = Record<string, string | number | null>;

export interface HourlyRowInput {
  time: string[];
  v: HourlySeries;
  aqi?: Record<string, number | null>;
  from: number;
  end: number;
  tempUnit: TempUnit;
  windUnit: WindUnit;
}

export interface MetricChartProps {
  metric: string | undefined;
  data: HourlyRow[];
  height: number | string;
  windUnit: WindUnit;
  hasChance: boolean;
  toggle: SeriesToggleApi;
}

export interface TrendRangeInput {
  len: number;
  custom: DateRange | null;
  back: number;
  today: string;
  followedAt: string;
}

export interface TrendWindow {
  from: string;
  to: string;
  windows: DateRange[];
}

export interface TrendNames {
  a: (attr: TrendAttr) => string;
  b: (attr: TrendAttr) => string;
}

export interface TrendRowInput {
  range: TrendWindow;
  back: number;
  attrs: TrendAttr[];
  names: TrendNames;
  log?: Partial<Record<string, DayRecord>>;
  normals?: Partial<Record<string, number>>;
  units: TrendUnits;
}

export interface TrendControlsProps {
  range: TrendWindow;
  onSheet: (sheet: 'attrs' | 'range') => void;
}

export interface TrendChartsProps {
  cityId: string;
  range: TrendWindow;
  attrs: TrendAttr[];
  names: TrendNames;
  data: Record<string, string | number | null>[];
  windUnit: WindUnit;
}
