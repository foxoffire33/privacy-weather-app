import type { CSSProperties, ReactNode } from 'react';
import type { City, DayRecord, TempUnit, WindUnit } from '../storesV2';
import type { DateRange } from './stores';

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
  summary?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}

export interface StatProps {
  k: string;
  v: ReactNode;
  s?: ReactNode;
  children?: ReactNode;
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

export interface DragScroll {
  x: number;
  left: number;
  moved: boolean;
}

export interface ReorderDrag {
  from: number;
  to: number;
  dy: number;
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
  ensureWindows: (cityId: string, windows: DateRange[]) => Promise<void>;
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
