import type { BackupDay } from './backup';
import type { City, Settings } from './common';

export interface RefreshOptions {
  maxAgeMs?: number;
}

export interface ImportedCounts {
  cities: number;
  days: number;
}

export interface StoredCounts {
  cities: number;
  days: number;
}

export interface Snapshot {
  cities: City[];
  history: Record<string, Record<string, BackupDay>>;
  settings: Settings;
}
