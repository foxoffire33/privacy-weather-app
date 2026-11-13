import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { definedOnly, isRecord, without } from '../core/guards';
import { idbStorage } from '../core/persistStorage';

import { FOLD_RULES } from './schema';

import type { EntityName, EntityTypeMap } from './schema';
import type { CacheTables, EntityCacheState, PersistedEntities, Table } from './types';

function emptyTables(): CacheTables {
  return { city: {}, dayRecord: {} };
}

function dropFrom(tables: CacheTables, name: EntityName, ids: readonly string[]): CacheTables {
  switch (name) {
    case 'city': { return { ...tables, city: without(tables.city, ids) }; }
    case 'dayRecord': { return { ...tables, dayRecord: without(tables.dayRecord, ids) }; }
  }
}

function hasTables(value: unknown): value is PersistedEntities {
  return isRecord(value) && isRecord(value.tables);
}

function foldEntity<N extends EntityName>(prev: EntityTypeMap[N] | undefined, next: EntityTypeMap[N], name: N): EntityTypeMap[N] {
  if (prev === undefined) {return next;}
  const folded: EntityTypeMap[N] = { ...prev, ...definedOnly(next) };
  const rule = FOLD_RULES[name];
  return rule === undefined ? folded : { ...folded, ...rule(prev, next) };
}

const ENTITIES_VERSION = 1;

function migrateEntities(persisted: unknown): PersistedEntities {
  return hasTables(persisted) ? persisted : { tables: emptyTables() };
}

export const useEntityCache = create<EntityCacheState>()(
  persist(
    (set, get) => ({
      tables: emptyTables(),
      upsert: (name, entity) => set((s) => ({
        tables: { ...s.tables, [name]: { ...s.tables[name], [entity.id]: foldEntity(s.tables[name][entity.id], entity, name) } },
      })),
      upsertMany: (name, entities) => set((s) => {
        if (entities.length === 0) {return s;}
        const table: Table<typeof name> = { ...s.tables[name] };
        for (const entity of entities) {table[entity.id] = foldEntity(table[entity.id], entity, name);}
        return { tables: { ...s.tables, [name]: table } };
      }),
      merge: (name, id, patch) => set((s) => {
        const existing = s.tables[name][id];
        if (existing === undefined) {return s;}
        return { tables: { ...s.tables, [name]: { ...s.tables[name], [id]: { ...existing, ...patch } } } };
      }),
      remove: (name, id) => set((s) => {
        if (s.tables[name][id] === undefined) { return s; }
        return { tables: dropFrom(s.tables, name, [id]) };
      }),
      removeMany: (name, ids) => set((s) => {
        const present = ids.filter((id) => s.tables[name][id] !== undefined);
        return present.length === 0 ? s : { tables: dropFrom(s.tables, name, present) };
      }),
      getOne: (name, id) => get().tables[name][id],
      getMany: (name, ids) => {
        const table = get().tables[name];
        const out: EntityTypeMap[typeof name][] = [];
        for (const id of ids) {
          const entity = table[id];
          if (entity !== undefined) {out.push(entity);}
        }
        return out;
      },
      clearEntities: () => { set({ tables: emptyTables() }); },
    }),
    {
      name: 'wl2-entities',
      version: ENTITIES_VERSION,
      migrate: migrateEntities,
      storage: idbStorage(),
      skipHydration: true,
      partialize: (s) => ({ tables: s.tables }),
      merge: (persisted, current) => {
        if (Object.keys(current.tables.dayRecord).length > 0 || !hasTables(persisted)) { return current; }
        return { ...current, tables: persisted.tables };
      },
    },
  ),
);

export const entityCache = {
  upsert: <N extends EntityName>(name: N, entity: EntityTypeMap[N]): void => { useEntityCache.getState().upsert(name, entity); },
  upsertMany: <N extends EntityName>(name: N, entities: EntityTypeMap[N][]): void => { useEntityCache.getState().upsertMany(name, entities); },
  merge: <N extends EntityName>(name: N, id: string, patch: Partial<EntityTypeMap[N]>): void => { useEntityCache.getState().merge(name, id, patch); },
  remove: (name: EntityName, id: string): void => { useEntityCache.getState().remove(name, id); },
  removeMany: (name: EntityName, ids: readonly string[]): void => { useEntityCache.getState().removeMany(name, ids); },
  getOne: <N extends EntityName>(name: N, id: string): EntityTypeMap[N] | undefined => useEntityCache.getState().getOne(name, id),
  getMany: <N extends EntityName>(name: N, ids: readonly string[]): EntityTypeMap[N][] => useEntityCache.getState().getMany(name, ids),
  clear: (): void => { useEntityCache.getState().clearEntities(); },
};
