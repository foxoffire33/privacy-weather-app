import { create } from 'zustand';

import { noteStorageFault } from '../bootStore';
import { definedOnly, isRecord, without } from '../core/guards';
import { clearRecords, deleteRecord, putRecord } from '../core/recordSync';

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

export function foldEntity<N extends EntityName>(prev: EntityTypeMap[N] | undefined, next: EntityTypeMap[N], name: N): EntityTypeMap[N] {
  if (prev === undefined) {return next;}
  const folded: EntityTypeMap[N] = { ...prev, ...definedOnly(next) };
  const rule = FOLD_RULES[name];
  return rule === undefined ? folded : { ...folded, ...rule(prev, next) };
}

const key = (name: EntityName, id: string) => `${name}:${id}`;

export const ENTITY_PREFIX = 'entity:';

function save(name: EntityName, entity: { id: string }): void {
  putRecord(ENTITY_PREFIX + key(name, entity.id), entity);
}

function drop(name: EntityName, id: string): void {
  deleteRecord(ENTITY_PREFIX + key(name, id));
}

export const useEntityCache = create<EntityCacheState>()((set, get) => ({
  tables: emptyTables(),
  upsert: (name, entity) => {
    const next = foldEntity(get().tables[name][entity.id], entity, name);
    set((s) => ({ tables: { ...s.tables, [name]: { ...s.tables[name], [entity.id]: next } } }));
    save(name, next);
  },
  upsertMany: (name, entities) => {
    if (entities.length === 0) { return; }
    const table: Table<typeof name> = { ...get().tables[name] };
    for (const entity of entities) {
      const next = foldEntity(table[entity.id], entity, name);
      table[entity.id] = next;
      save(name, next);
    }
    set((s) => ({ tables: { ...s.tables, [name]: table } }));
  },
  hydrate: (name, entities) => {
    if (entities.length === 0) { return; }
    set((s) => {
      const table: Table<typeof name> = { ...s.tables[name] };
      let added = 0;
      for (const entity of entities) {
        if (table[entity.id] === undefined) {
          table[entity.id] = entity;
          added++;
        }
      }
      return added === 0 ? s : { tables: { ...s.tables, [name]: table } };
    });
  },
  merge: (name, id, patch) => {
    const existing = get().tables[name][id];
    if (existing === undefined) { return; }
    const next = { ...existing, ...patch };
    set((s) => ({ tables: { ...s.tables, [name]: { ...s.tables[name], [id]: next } } }));
    save(name, next);
  },
  remove: (name, id) => {
    drop(name, id);
    if (get().tables[name][id] === undefined) { return; }
    set((s) => ({ tables: dropFrom(s.tables, name, [id]) }));
  },
  removeMany: (name, ids) => {
    for (const id of ids) { drop(name, id); }
    const present = ids.filter((id) => get().tables[name][id] !== undefined);
    if (present.length === 0) { return; }
    set((s) => ({ tables: dropFrom(s.tables, name, present) }));
  },
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
  clearEntities: () => {
    set({ tables: emptyTables() });
    void clearRecords(ENTITY_PREFIX).catch(noteStorageFault);
  },
}));

export function isPersistedEntities(value: unknown): value is PersistedEntities {
  return hasTables(value);
}

export const entityCache = {
  upsert: <N extends EntityName>(name: N, entity: EntityTypeMap[N]): void => { useEntityCache.getState().upsert(name, entity); },
  upsertMany: <N extends EntityName>(name: N, entities: EntityTypeMap[N][]): void => { useEntityCache.getState().upsertMany(name, entities); },
  hydrate: <N extends EntityName>(name: N, entities: EntityTypeMap[N][]): void => { useEntityCache.getState().hydrate(name, entities); },
  merge: <N extends EntityName>(name: N, id: string, patch: Partial<EntityTypeMap[N]>): void => { useEntityCache.getState().merge(name, id, patch); },
  remove: (name: EntityName, id: string): void => { useEntityCache.getState().remove(name, id); },
  removeMany: (name: EntityName, ids: readonly string[]): void => { useEntityCache.getState().removeMany(name, ids); },
  getOne: <N extends EntityName>(name: N, id: string): EntityTypeMap[N] | undefined => useEntityCache.getState().getOne(name, id),
  getMany: <N extends EntityName>(name: N, ids: readonly string[]): EntityTypeMap[N][] => useEntityCache.getState().getMany(name, ids),
  clear: (): void => { useEntityCache.getState().clearEntities(); },
};
