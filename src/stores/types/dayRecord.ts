export interface DayRecord {
  id: string;
  cityId: string;
  date: string;
  hi?: number | null;
  lo?: number | null;
  feelsHi?: number | null;
  feelsLo?: number | null;
  mm?: number | null;
  snow?: number | null;
  wind?: number | null;
  gust?: number | null;
  sunshine?: number | null;
  uv?: number | null;
  code?: number | null;
  source: 'log' | 'filled' | 'edited';
  snapshots: number;
}

export interface ArchiveYear {
  year: number;
  hi?: number;
  lo?: number;
  mm?: number;
  error?: boolean;
}

export interface DayEntry {
  hi: number | null;
  lo: number | null;
  feelsHi: number | null;
  feelsLo: number | null;
  mm: number | null;
  snow: number | null;
  wind: number | null;
  gust: number | null;
  sunshine: number | null;
  uv: number | null;
  code: number | null;
}
