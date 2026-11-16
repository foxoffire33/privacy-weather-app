import type { ForecastData, LandMap, RadarFrame } from '../stores';
import type { ChartHeight } from './components';

export interface RadarPanelProps {
  cityId: string;
  timeZone: string;
  forecast: ForecastData;
  height?: ChartHeight;
}

export interface RadarZoomProps {
  cell: number;
}

export interface RadarMapProps {
  land: LandMap;
  frame: RadarFrame | undefined;
  visibleCols: number;
  visibleRows: number;
  baseScale: number;
  zoom: number;
  onPinchZoom: (ratio: number) => boolean;
  height?: ChartHeight;
}

export interface ModelPoint {
  time: number;
  mmPerHour: number;
}

export type TimelineKind = 'radar' | 'nowcast' | 'model';

export interface TimelineFrame {
  time: number;
  kind: TimelineKind;
  frame: RadarFrame | undefined;
  mmPerHour: number | null;
}

export interface RadarFramesProps {
  frames: readonly TimelineFrame[];
  selected: number;
  cols: number;
  rows: number;
  onSelect: (time: number) => void;
}

export interface RadarNoticeProps {
  text: string;
  action?: string;
  onAction?: () => void;
}

export interface RadarReadoutProps {
  frame: TimelineFrame | undefined;
  nowTime: number;
  timeZone: string;
}

export interface RadarControlsProps {
  frames: readonly TimelineFrame[];
  index: number;
  cols: number;
  rows: number;
  cell: number;
  stale: boolean;
  visible: boolean;
  onRetry: () => void;
}
