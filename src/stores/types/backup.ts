import type { City, Settings } from './common';
import type { DayRecord } from './dayRecord';

export type BackupDay = Omit<DayRecord, 'id' | 'cityId'>;

export interface Backup {
  version: 1;
  exportedAt: string;
  settings: Partial<Omit<Settings, 'apiKey'>>;
  cities: City[];
  history: Record<string, Record<string, BackupDay>>;
}

export interface BackupParts {
  cities: boolean;
  history: boolean;
  settings: boolean;
}
