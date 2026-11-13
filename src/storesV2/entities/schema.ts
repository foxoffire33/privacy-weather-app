import type { City, DayRecord } from '../types';

export interface EntityTypeMap {
  city: City;
  dayRecord: DayRecord;
}

export type EntityName = keyof EntityTypeMap;

export const ENTITY_NAMES: readonly EntityName[] = ['city', 'dayRecord'];

export const dayKey = (cityId: string, date: string): string => `${cityId}:${date}`;

export const FOLD_RULES: { [N in EntityName]?: (prev: EntityTypeMap[N], next: EntityTypeMap[N]) => Partial<EntityTypeMap[N]> } = {
  dayRecord: (prev, next) => ({
    source: prev.source === 'log' ? 'log' : next.source,
    snapshots: Math.max(prev.snapshots, next.snapshots),
  }),
};
