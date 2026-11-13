import type { QueryState } from '../core/types';
import type { TempUnit, WindUnit } from './common';
import type { DayRecord } from './day-record';

export interface Units {
  temp: TempUnit;
  wind: WindUnit;
}

export interface LookupView {
  record: DayRecord | undefined;
  query: QueryState;
}
