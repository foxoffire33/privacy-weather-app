export interface PollenLevel {
  level: number;
  label: string;
}

export interface PressureTrend {
  delta: number;
  label: string;
}

export type Step<T> = readonly [number, T];
