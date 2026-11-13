import type { DayRecord, HourlyVar, TempUnit, WindUnit } from '../stores';
import type { MessageKey } from './i18n';
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
