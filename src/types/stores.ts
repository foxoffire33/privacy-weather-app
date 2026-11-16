import type { Backup, BackupParts, QueryState } from '../stores';

export interface DateRange {
  from: string;
  to: string;
}

export type Next48View = 'radar' | 'charts';

export interface UiState {
  pageIndex: number;
  expandedDay: Record<string, string | null>;
  chartMetric: string;
  historyRange: number;
  lookupDraft: string;
  logFilter: string;
  logLimit: number;
  hiddenSeries: Partial<Record<string, string[]>>;
  gestureHintSeen: boolean;
  fullscreenChart: string | null;
  next48View: Next48View;
  radarFrame: number | null;
  radarCell: number;
  setRadarCell: (cell: number) => void;
  setNext48View: (view: Next48View) => void;
  setRadarFrame: (time: number | null) => void;
  setChartMetric: (m: string) => void;
  setHistoryRange: (d: number) => void;
  setLookupDraft: (date: string) => void;
  setLogFilter: (q: string) => void;
  showMoreLog: () => void;
  resetLogLimit: () => void;
  toggleDay: (cityId: string, date: string) => void;
  toggleSeries: (scope: string, name: string) => void;
  dismissGestureHint: () => void;
  openChart: (id: string) => void;
  closeChart: () => void;
  setPage: (i: number) => void;
}

export interface TrendsState {
  picked: string[];
  len: number;
  custom: DateRange | null;
  back: number;
  rangeDraft: DateRange;
  download: QueryState;
  attempted: string[];
  failed: string[];
  togglePicked: (key: string) => void;
  setLen: (len: number) => void;
  setCustom: (range: DateRange | null) => void;
  setBack: (years: number) => void;
  setRangeDraft: (patch: Partial<DateRange>) => void;
  ensureWindows: (cityId: string, windows: DateRange[]) => PromiseLike<void>;
  retryFailed: (cityId: string, windows: DateRange[]) => Promise<void>;
}

export type AddDatesResult =
  | { ok: true; added: number; updated: number; kept: number }
  | { ok: false; error: string };

export interface AddDatesState {
  draft: DateRange;
  result: AddDatesResult | null;
  runId: number;
  reset: (maxDate: string) => void;
  setDraft: (patch: Partial<DateRange>) => void;
  run: (cityId: string) => Promise<void>;
}

export type BackupResult =
  | { ok: true; cities: number; days: number }
  | { ok: false; error: string };

export interface BackupState {
  pending: Backup | null;
  parts: BackupParts;
  result: BackupResult | null;
  pickId: number;
  pick: (file: File | null) => Promise<void>;
  setPart: (part: keyof BackupParts, on: boolean) => void;
  confirm: () => void;
  cancel: () => void;
  exportFile: () => Promise<void>;
}

export type TrendsSheet = 'attrs' | 'range' | null;
