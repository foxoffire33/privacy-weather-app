import type { FoldRules } from './types';

export type { EntityName, EntityTypeMap } from './types';

export const dayKey = (cityId: string, date: string): string => `${cityId}:${date}`;

export const FOLD_RULES: FoldRules = {
  dayRecord: (prev, next) => ({
    source: prev.source === 'log' ? 'log' : next.source,
    snapshots: Math.max(prev.snapshots, next.snapshots),
  }),
};
