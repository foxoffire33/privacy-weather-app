import { useDiagnosticsStore } from '../diagnosticsStore';

import { classify } from './appError';
import { errorMessage } from './errors';
import { isRecord } from './guards';
import { idbDel, idbGet, idbSet, RETRYABLE_WRITE_CODES, toStorageError } from './idb';

import type { AppError } from './appError';
import type { StorageError, StorageErrorCode } from './idb';
import type { HydratablePersist } from './types';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

const WRITE_DEBOUNCE_MS = 250;
const RETRY_BASE_MS = 250;
const RETRY_MAX_MS = 30_000;
const MAX_AUTO_RETRIES = 8;
const REHYDRATE_RETRY_MS = 3000;

interface PendingWriteState {
  revision: number;
  value: unknown;
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
  chain: Promise<void>;
  lastError: StorageError | null;
}

export interface PersistenceStatus {
  pending: boolean;
  code: StorageErrorCode | null;
  lastError: string | null;
  lastSuccessfulWriteAt: number | null;
}

function isStorageValue<S>(value: unknown): value is StorageValue<S> {
  return isRecord(value) && isRecord(value.state);
}

const pending = new Map<string, PendingWriteState>();
const deleting = new Map<string, Promise<void>>();
const readErrors = new Map<string, StorageError>();
const rehydrators = new Map<string, () => Promise<void> | void>();
const lastSuccess = new Map<string, number>();
let lastSuccessfulWriteAt: number | null = null;
let faultListener: ((error: StorageError) => void) | null = null;
let recoveredListener: (() => void) | null = null;
let suppressedWrites = 0;

export function withoutPersistWrites<T>(apply: () => T): T {
  suppressedWrites += 1;
  try {
    return apply();
  } finally {
    suppressedWrites -= 1;
  }
}

export function onPersistFault(listener: ((error: StorageError) => void) | null): void {
  faultListener = listener;
}

export function onPersistRecovered(listener: (() => void) | null): void {
  recoveredListener = listener;
}

export function registerRehydration(name: string, rehydrate: () => Promise<void> | void): void {
  rehydrators.set(name, rehydrate);
}

function backoffDelay(attempts: number): number {
  const base = Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS);
  return base * (0.5 + Math.random() * 0.5);
}

async function runFlushOnce(name: string): Promise<void> {
  const state = pending.get(name);
  if (state === undefined) { return; }
  const revision = state.revision;
  const value = state.value;
  const readError = readErrors.get(name);
  if (readError !== undefined) {
    if (state.revision !== revision) { return; }
    state.lastError = readError;
    return;
  }
  try {
    await idbSet(name, value);
  } catch (error) {
    const storageError = toStorageError('write', error);
    if (state.revision !== revision) { return; }
    state.lastError = storageError;
    state.attempts += 1;
    if (state.attempts <= MAX_AUTO_RETRIES && RETRYABLE_WRITE_CODES.has(storageError.code)) {
      state.timer = setTimeout(() => { state.timer = null; flush(name); }, backoffDelay(state.attempts));
    }
    faultListener?.(storageError);
    return;
  }
  if (state.revision !== revision) { return; }
  state.lastError = null;
  state.attempts = 0;
  const at = Date.now();
  lastSuccess.set(name, at);
  lastSuccessfulWriteAt = at;
  pending.delete(name);
  useDiagnosticsStore.getState().bump('kvFlushes');
  recoveredListener?.();
}

function flush(name: string): void {
  const state = pending.get(name);
  if (state === undefined) { return; }
  state.chain = state.chain.then(
    async () => { await runFlushOnce(name).catch(() => null); },
    async () => { await runFlushOnce(name).catch(() => null); },
  );
}

function flushAll(): void {
  for (const name of pending.keys()) { flush(name); }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { flushAll(); } });
}

export function idbStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      let value: unknown;
      try {
        value = await idbGet(name);
      } catch (error) {
        readErrors.set(name, toStorageError('read', error));
        throw error;
      }
      const wasFault = readErrors.get(name);
      readErrors.delete(name);
      const state = pending.get(name);
      if (state !== undefined && wasFault !== undefined && state.lastError === wasFault) { state.lastError = null; }
      return isStorageValue<S>(value) ? value : null;
    },
    setItem: (name, value) => {
      if (suppressedWrites > 0) { return; }
      const state: PendingWriteState = pending.get(name) ?? { revision: 0, value: undefined, attempts: 0, timer: null, chain: deleting.get(name) ?? Promise.resolve(), lastError: null };
      state.revision += 1;
      state.value = value;
      state.attempts = 0;
      if (state.timer !== null) { clearTimeout(state.timer); }
      pending.set(name, state);
      if (readErrors.has(name)) { return; }
      state.timer = setTimeout(() => { state.timer = null; flush(name); }, WRITE_DEBOUNCE_MS);
    },
    removeItem: async (name) => {
      const state = pending.get(name);
      if (state !== undefined && state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
      const revision = state?.revision;
      const predecessor = state?.chain ?? deleting.get(name) ?? Promise.resolve();
      const deletion = predecessor.catch(() => null).then(async () => {
        try {
          await idbDel(name);
        } catch (error) {
          const storageError = toStorageError('write', error);
          if (state !== undefined) { state.lastError = storageError; }
          faultListener?.(storageError);
          throw storageError;
        }
        lastSuccess.delete(name);
        if (state !== undefined && pending.get(name) === state && state.revision === revision) { pending.delete(name); }
      });
      deleting.set(name, deletion);
      if (state !== undefined) { state.chain = deletion; }
      try {
        await deletion;
      } finally {
        if (deleting.get(name) === deletion) { deleting.delete(name); }
      }
    },
  };
}

async function awaitKey(name: string): Promise<void> {
  const state = pending.get(name);
  if (state === undefined) { return; }
  if (state.lastError !== null) { throw state.lastError; }
  flush(name);
  await state.chain;
  return awaitKey(name);
}

export async function flushPersistedState(name?: string): Promise<void> {
  if (name === undefined) {
    const keys = [...pending.keys()];
    await Promise.all(keys.map(async (key) => { await awaitKey(key); }));
  } else {
    await awaitKey(name);
  }
}

async function retryHydration(name: string): Promise<void> {
  const rehydrate = rehydrators.get(name);
  if (rehydrate === undefined) { return; }
  const deadline = new Promise<void>((resolve) => { setTimeout(resolve, REHYDRATE_RETRY_MS); });
  await Promise.race([Promise.resolve(rehydrate()).catch(() => null), deadline]);
}

export async function retryPersistedState(name?: string): Promise<void> {
  const keys = name === undefined ? [...new Set([...pending.keys(), ...readErrors.keys()])] : [name];
  await Promise.all(keys.map(async (key) => {
    const state = pending.get(key);
    if (state === undefined && readErrors.has(key)) {
      await retryHydration(key);
      return;
    }
    if (state === undefined) { return; }
    if (readErrors.has(key)) {
      await retryHydration(key);
      const current = readErrors.get(key);
      if (current !== undefined) {
        state.lastError = current;
        state.attempts = 0;
        return;
      }
    }
    state.lastError = null;
    state.attempts = 0;
    if (state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
    flush(key);
  }));
}

export function persistenceStatus(name?: string): PersistenceStatus {
  if (name !== undefined) {
    const state = pending.get(name);
    return {
      pending: state !== undefined,
      code: state !== undefined && state.lastError !== null ? state.lastError.code : null,
      lastError: state !== undefined && state.lastError !== null ? errorMessage(state.lastError) : null,
      lastSuccessfulWriteAt: lastSuccess.get(name) ?? null,
    };
  }
  let code: StorageErrorCode | null = null;
  let lastError: string | null = null;
  for (const state of pending.values()) {
    if (lastError === null && state.lastError !== null) {
      code = state.lastError.code;
      lastError = errorMessage(state.lastError);
    }
  }
  return { pending: pending.size > 0, code, lastError, lastSuccessfulWriteAt };
}

export function hydrationFault(name: string): AppError | null {
  const error = readErrors.get(name);
  return error === undefined ? null : classify(error);
}

export function trackRehydration(name: string, snapshot?: () => unknown): (state: unknown) => (state?: unknown, error?: unknown) => void {
  return () => (_state, error) => {
    if (error !== undefined) {
      readErrors.set(name, toStorageError('read', error));
      return;
    }
    readErrors.delete(name);
    const state = pending.get(name);
    if (state === undefined) { return; }
    if (snapshot !== undefined) {
      state.revision += 1;
      state.value = snapshot();
    }
    if (state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
    flush(name);
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function mergeCollection(base: unknown, current: unknown, fromDisk: unknown): unknown {
  if (isStringArray(base) && isStringArray(current) && isStringArray(fromDisk)) {
    return [...new Set([...fromDisk, ...current])];
  }
  if (isRecord(base) && isRecord(current) && isRecord(fromDisk)) {
    if (Object.keys(base).length === 0) {
      return { ...fromDisk, ...current };
    }
    const merged: Record<string, unknown> = { ...current };
    for (const key of Object.keys(base)) {
      const edited = JSON.stringify(Reflect.get(current, key)) !== JSON.stringify(Reflect.get(base, key));
      if (!edited && key in fromDisk) { merged[key] = fromDisk[key]; }
    }
    return merged;
  }
  return current;
}

export function mergePreservingEdits<S extends object>(initial: Partial<S>): (persisted: unknown, current: S) => S {
  return (persisted, current) => {
    if (!isRecord(persisted)) { return current; }
    const result = { ...current };
    for (const key of Object.keys(initial)) {
      const base = Reflect.get(initial, key);
      const cur = Reflect.get(current, key);
      if (JSON.stringify(cur) === JSON.stringify(base)) {
        if (key in persisted) { Reflect.set(result, key, persisted[key]); }
        continue;
      }
      Reflect.set(result, key, mergeCollection(base, cur, persisted[key]));
    }
    return result;
  };
}

export type HydrationResult = { status: 'hydrated' } | { status: 'timeout' };

export async function waitForHydration(store: HydratablePersist, timeoutMs = 3000): Promise<HydrationResult> {
  if (store.persist.hasHydrated()) { return { status: 'hydrated' }; }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => { unsub(); resolve(); }, timeoutMs);
    const unsub = store.persist.onFinishHydration(() => { clearTimeout(timer); unsub(); resolve(); });
  });
  return store.persist.hasHydrated() ? { status: 'hydrated' } : { status: 'timeout' };
}
