import type { FoldRules } from './types';

export type { EntityName, EntityTypeMap } from './types';

export const dayKey = (cityId: string, date: string): string => `${cityId}:${date}`;

export const FOLD_RULES: FoldRules = {
  dayRecord: (prev, next) => {
    if (prev.source === 'edited' && next.source !== 'edited') { return prev; }
    return {
      source: prev.source === 'log' ? 'log' : next.source,
      snapshots: Math.max(prev.snapshots, next.snapshots),
    };
  },
};
