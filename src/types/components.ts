import type { City, DayData, DayRecord, ForecastEntry, TempUnit, Units, WindUnit } from '../stores';
import type { DateRange } from './stores';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export type IconName =
  | 'list' | 'sliders' | 'back' | 'plus' | 'search' | 'pin' | 'download' | 'up' | 'down'
  | 'grip' | 'x' | 'refresh' | 'arrow' | 'arrowUp' | 'lock' | 'expand';

export interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
}

export interface ScreenHeaderProps {
  right?: ReactNode;
}

export interface SkProps {
  w?: number | string;
  h?: number;
  mt?: number;
  style?: CSSProperties;
}

export interface StatGridSkProps {
  n?: number;
}

export interface SectionSkProps {
  title: string;
  n?: number;
}

export interface RowsSkProps {
  n: number;
  h?: number;
}

export interface ChartSkProps {
  h?: number;
}

export interface SwipeRowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}

export interface SwipeGesture {
  x: number;
  y: number;
  base: number;
  dir: 'h' | 'v' | null;
  width: number;
}

export interface BarProps {
  pct: number;
  level?: number | null;
  color?: string;
}

export interface SectionProps {
  title: string;
  summary?: string | null;
  action?: ReactElement;
  children?: ReactNode;
}

export interface StatProps {
  k: string;
  v: ReactNode;
  s?: string | ReactElement | null;
  children?: ReactElement;
}

export interface TrendsProps {
  cityId: string;
  log?: Record<string, DayRecord>;
  normals?: Record<string, number>;
  today: string;
  followedAt: string;
  tempUnit: TempUnit;
  windUnit: WindUnit;
}

export interface SheetCloseProps {
  onClose: () => void;
}

export interface RangeSheetProps {
  max: string;
  onApply: (range: { from: string; to: string }) => void;
  onClose: () => void;
}

export interface CityPageProps {
  city: City;
  isDefault: boolean;
}

export interface DeferredProps {
  h: number;
  children: ReactNode;
}

export interface CityScreenProps {
  cityId: string;
}

export interface DayViewProps {
  cityId: string;
  date: string;
}

export interface ImportRangeProps {
  cityId: string;
  maxDate: string;
}

export interface GestureHintProps {
  multiple: boolean;
}

export interface PagerGesture {
  x: number;
  y: number;
  id: number;
  active: boolean;
}

export interface HourlyCellProps {
  k: string;
  v: string;
}

export interface HourGroup {
  date: string;
  rows: number[];
}

export interface ReorderDrag {
  from: number;
  to: number;
  dy: number;
  rowH: number;
}

export interface StripCell {
  time: string;
  date: string;
  isNow: boolean;
  past: boolean;
  temp: number | null | undefined;
  p: number | null;
  wind: number | null | undefined;
}

export interface AqiPeak {
  v: number;
  time: string;
}

export interface FrameProps {
  children: ReactNode;
}

export interface DayHeaderProps {
  cityName: string;
  date: string;
}

export interface DayBodyProps {
  cityId: string;
  date: string;
  cityName: string;
}

export interface YearsRowProps {
  cityId: string;
  today: string;
  onOpen: (date: string) => void;
}

export interface LookupCardProps {
  cityId: string;
  date: string;
  onOpen: (date: string) => void;
}

export interface TrendsFillProps {
  cityId: string;
  windows: DateRange[];
  ensureWindows: (cityId: string, windows: DateRange[]) => PromiseLike<void>;
  children: ReactNode;
}

export type ChartHeight = number | string;

export interface FullscreenChartProps {
  id: string;
  title: string;
  render: (height: ChartHeight) => ReactNode;
}

export interface ExpandButtonProps {
  id: string;
}

export interface StatusMessage {
  ok: boolean;
  text: string;
}

export type Rgb = readonly [number, number, number];

export interface CityDataProps {
  city: City;
  entry: ForecastEntry;
  units: Units;
}

export interface CityHeroProps extends CityDataProps {
  isDefault: boolean;
}

export interface CityErrorProps extends CityPageProps {
  error: string | null;
}

export interface ExpandableProps extends CityDataProps {
  expanded: string | null;
}

export interface EntryProps {
  entry: ForecastEntry;
  units: Units;
}

export interface NowcastProps {
  entry: ForecastEntry;
}

export interface StripLabel extends StripCell {
  label: string;
  dayBreak: boolean;
  dayName: string;
}

export interface DayDividerProps {
  name: string;
  on: boolean;
}

export interface DayRowProps extends EntryProps {
  cityId: string;
  date: string;
  index: number;
  label: string;
  open: boolean;
}

export interface CityFooterProps {
  city: City;
  entry: ForecastEntry;
  loading: boolean;
}

export interface PollutantRowProps {
  label: string;
  unit: string;
  value: number | null;
  level: number | null;
}

export interface DaySectionProps {
  day: DayData;
  units: Units;
}

export interface DayTempProps extends DaySectionProps {
  normal: number | undefined;
}

export interface DayHeroValues {
  hi: number | null;
  lo: number | null | undefined;
  feelsHi: number | null | undefined;
  feelsLo: number | null | undefined;
  code: number | null | undefined;
}

export interface DayHourlyProps extends DaySectionProps {
  cityId: string;
}

export interface HistoryLogProps {
  cityId: string;
  rows: DayRecord[];
  today: string;
  onOpen: (date: string) => void;
}

export interface HistoryRowProps {
  cityId: string;
  record: DayRecord;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (date: string) => void;
}
