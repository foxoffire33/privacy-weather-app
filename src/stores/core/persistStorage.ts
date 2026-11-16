import { errorMessage } from './errors';
import { isRecord } from './guards';
import { idbDel, idbGet, idbSet, toStorageError } from './idb';

import type { StorageError } from './idb';
import type { HydratablePersist } from './types';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

const WRITE_DEBOUNCE_MS = 250;
const RETRY_BASE_MS = 250;
const RETRY_MAX_MS = 30_000;
const MAX_AUTO_RETRIES = 8;

const RETRYABLE_WRITE_CODES: ReadonlySet<StorageError['code']> = new Set(['open-failed', 'blocked', 'transaction-aborted', 'write-failed']);

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
  lastError: string | null;
  lastSuccessfulWriteAt: number | null;
}

function isStorageValue<S>(value: unknown): value is StorageValue<S> {
  return isRecord(value) && isRecord(value.state);
}

const pending = new Map<string, PendingWriteState>();
const readState = new Map<string, 'ok' | 'failed'>();
let lastSuccessfulWriteAt: number | null = null;

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
        readState.set(name, 'failed');
        throw error;
      }
      readState.set(name, 'ok');
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
      if (readState.get(name) === 'failed') { return; }
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

export function persistenceStatus(name?: string): PersistenceStatus {
  if (name !== undefined) {
    const state = pending.get(name);
    return {
      pending: state !== undefined,
      lastError: state !== undefined && state.lastError !== null ? errorMessage(state.lastError) : null,
      lastSuccessfulWriteAt: state === undefined ? null : state.lastSuccessfulWriteAt,
    };
  }
  let lastError: string | null = null;
  for (const state of pending.values()) {
    if (lastError === null && state.lastError !== null) { lastError = errorMessage(state.lastError); }
  }
  return { pending: pending.size > 0, lastError, lastSuccessfulWriteAt };
}

export async function waitForHydration(store: HydratablePersist): Promise<void> {
  if (store.persist.hasHydrated()) { return; }
  await new Promise<void>((resolve) => {
    const unsub = store.persist.onFinishHydration(() => { unsub(); resolve(); });
    setTimeout(() => { unsub(); resolve(); }, 3000);
  });
}
