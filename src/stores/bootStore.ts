import { create } from 'zustand';

import { classify } from './core/appError';

import type { BootState } from './storeTypes';

export const useBootStore = create<BootState>()(() => ({ phase: 'booting', hydrated: false, historyReady: false, storageBlocked: false, storageError: null, storageQuotaExceeded: false }));

export function noteStorageFault(error: unknown): void {
  const appError = classify(error);
  useBootStore.setState((s) => ({
    phase: s.phase === 'ready' || s.phase === 'booting' ? 'degraded' : s.phase,
    storageError: s.storageError ?? appError,
    storageQuotaExceeded: s.storageQuotaExceeded || appError.code === 'storage.quota-exceeded',
  }));
}
