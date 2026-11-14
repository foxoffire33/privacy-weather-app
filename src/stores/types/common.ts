export interface GeoResult {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  admin1?: string;
  country?: string;
}

export interface City {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  followedAt: string;
}

export type Accent = 'green' | 'red' | 'blue' | 'off' | 'custom';
export type TempUnit = 'C' | 'F';
export type WindUnit = 'kmh' | 'ms' | 'mph';

export interface Settings {
  apiKey: string;
  server: string;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  snapshotMinutes: number;
  backfill: boolean;
  accent: Accent;
  accentColor: string;
  language: string;
  offline: boolean;
}
