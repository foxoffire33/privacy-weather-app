import type { QueryState } from '../core/types';
import type { TempUnit, WindUnit } from './common';
import type { DayRecord } from './dayRecord';
import type { LandMap, ModelSet, RadarSet } from './radar';

export interface Units {
  temp: TempUnit;
  wind: WindUnit;
}

export interface RadarView {
  key: string;
  shownCell: number;
  land: LandMap | undefined;
  radar: RadarSet | undefined;
  model: ModelSet | undefined;
  query: QueryState;
}

export interface LookupView {
  record: DayRecord | undefined;
  query: QueryState;
}

export interface LogNeighbours {
  prev: string | undefined;
  next: string | undefined;
}
