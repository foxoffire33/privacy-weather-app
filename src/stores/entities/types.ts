import type { City, DayRecord } from '../types';

export interface EntityTypeMap {
  city: City;
  dayRecord: DayRecord;
}

export type EntityName = keyof EntityTypeMap;

export type FoldRule<N extends EntityName> = (prev: EntityTypeMap[N], next: EntityTypeMap[N]) => Partial<EntityTypeMap[N]>;

export type FoldRules = { [N in EntityName]?: FoldRule<N> };

export type Table<N extends EntityName> = Partial<Record<string, EntityTypeMap[N]>>;
export type CacheTables = { [N in EntityName]: Table<N> };

export interface EntityCacheState {
  tables: CacheTables;
  upsert: <N extends EntityName>(name: N, entity: EntityTypeMap[N]) => void;
  upsertMany: <N extends EntityName>(name: N, entities: EntityTypeMap[N][]) => void;
  merge: <N extends EntityName>(name: N, id: string, patch: Partial<EntityTypeMap[N]>) => void;
  remove: (name: EntityName, id: string) => void;
  removeMany: (name: EntityName, ids: readonly string[]) => void;
  getOne: <N extends EntityName>(name: N, id: string) => EntityTypeMap[N] | undefined;
  getMany: <N extends EntityName>(name: N, ids: readonly string[]) => EntityTypeMap[N][];
  clearEntities: () => void;
}

export interface PersistedEntities {
  tables: CacheTables;
}
