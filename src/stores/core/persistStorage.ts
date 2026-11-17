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

interface PendingWriteState {
  revision: number;
  value: unknown;
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
  chain: Promise<void>;
  lastError: StorageError | null;
  lastSuccessfulWriteAt: number | null;
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
const readErrors = new Map<string, StorageError>();
let lastSuccessfulWriteAt: number | null = null;
let faultListener: ((error: StorageError) => void) | null = null;

export function onPersistFault(listener: ((error: StorageError) => void) | null): void {
  faultListener = listener;
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
  state.lastSuccessfulWriteAt = Date.now();
  lastSuccessfulWriteAt = state.lastSuccessfulWriteAt;
  pending.delete(name);
}

function flush(name: string): void {
  const state = pending.get(name);
  if (state === undefined) { return; }
  state.chain = state.chain.then(async () => runFlushOnce(name));
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
      readErrors.delete(name);
      if (pending.has(name)) { flush(name); }
      return isStorageValue<S>(value) ? value : null;
    },
    setItem: (name, value) => {
      const state: PendingWriteState = pending.get(name) ?? { revision: 0, value: undefined, attempts: 0, timer: null, chain: Promise.resolve(), lastError: null, lastSuccessfulWriteAt: null };
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
      if (state !== undefined) {
        if (state.timer !== null) { clearTimeout(state.timer); }
        await state.chain;
        pending.delete(name);
      }
      await idbDel(name);
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
    for (const key of keys) { flush(key); }
    await Promise.all(keys.map(async (key) => { await awaitKey(key); }));
  } else {
    await awaitKey(name);
  }
}

export function retryPersistedState(name?: string): void {
  const keys = name === undefined ? [...pending.keys()] : [name];
  for (const key of keys) {
    const state = pending.get(key);
    if (state === undefined) { continue; }
    state.lastError = null;
    state.attempts = 0;
    if (state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
    flush(key);
  }
}

export function persistenceStatus(name?: string): PersistenceStatus {
  if (name !== undefined) {
    const state = pending.get(name);
    return {
      pending: state !== undefined,
      code: state !== undefined && state.lastError !== null ? state.lastError.code : null,
      lastError: state !== undefined && state.lastError !== null ? errorMessage(state.lastError) : null,
      lastSuccessfulWriteAt: state === undefined ? null : state.lastSuccessfulWriteAt,
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

export function trackRehydration(name: string): (state: unknown) => (state?: unknown, error?: unknown) => void {
  return () => (_state, error) => {
    if (error === undefined) { readErrors.delete(name); } else { readErrors.set(name, toStorageError('read', error)); }
  };
}

export function stateEdited<S extends object>(initial: Partial<S>, current: S): boolean {
  const keys = Object.keys(initial);
  return keys.some((key) => JSON.stringify(Reflect.get(current, key)) !== JSON.stringify(Reflect.get(initial, key)));
}

export function mergePreservingEdits<S extends object>(initial: Partial<S>): (persisted: unknown, current: S) => S {
  return (persisted, current) => (stateEdited(initial, current) || !isRecord(persisted) ? current : { ...current, ...persisted });
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
