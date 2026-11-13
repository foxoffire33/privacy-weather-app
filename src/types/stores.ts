import type { Backup, BackupParts, QueryState } from '../storesV2';
import type { Route } from './route';

export interface DateRange {
  from: string;
  to: string;
}

export interface UiState {
  route: Route;
  stack: Route[];
  pageIndex: number;
  expandedDay: Record<string, string | null>;
  chartMetric: string;
  historyRange: number;
  lookupDraft: string;
  hiddenSeries: Record<string, string[]>;
  gestureHintSeen: boolean;
  setChartMetric: (m: string) => void;
  setHistoryRange: (d: number) => void;
  setLookupDraft: (date: string) => void;
  toggleDay: (cityId: string, date: string) => void;
  toggleSeries: (scope: string, name: string) => void;
  dismissGestureHint: () => void;
  navigate: (route: Route) => void;
  back: () => void;
  goHome: (pageIndex?: number) => void;
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
  togglePicked: (key: string) => void;
  setLen: (len: number) => void;
  setCustom: (range: DateRange | null) => void;
  setBack: (years: number) => void;
  setRangeDraft: (patch: Partial<DateRange>) => void;
  ensureWindows: (cityId: string, windows: DateRange[]) => Promise<void>;
}

export type AddDatesResult =
  | { ok: true; added: number; updated: number; kept: number }
  | { ok: false; error: string };

export interface AddDatesState {
  draft: DateRange;
  result: AddDatesResult | null;
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
  pick: (file: File | null) => Promise<void>;
  setPart: (part: keyof BackupParts, on: boolean) => void;
  confirm: () => void;
  cancel: () => void;
  exportFile: () => void;
}

export type TrendsSheet = 'attrs' | 'range' | null;
