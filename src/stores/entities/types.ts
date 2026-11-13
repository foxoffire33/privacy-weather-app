import type { EntityName, EntityTypeMap } from './schema';

export type Table<N extends EntityName> = Record<string, EntityTypeMap[N]>;
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
