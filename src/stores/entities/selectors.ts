import { entityCache } from './cache';
import { dayKey } from './schema';
import type { City, DayRecord } from '../types';

export const cityById = (id: string): City | undefined => entityCache.getOne('city', id);

export const citiesByIds = (ids: readonly string[]): City[] => entityCache.getMany('city', ids);

export const dayRecordAt = (cityId: string, date: string): DayRecord | undefined =>
  entityCache.getOne('dayRecord', dayKey(cityId, date));

export const dayRecordsFor = (cityId: string, dates: readonly string[]): DayRecord[] =>
  entityCache.getMany('dayRecord', dates.map((date) => dayKey(cityId, date)));
