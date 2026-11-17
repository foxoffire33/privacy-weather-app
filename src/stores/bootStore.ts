import { create } from 'zustand';

import { classify } from './core/appError';

import type { BootState } from './storeTypes';

export const useBootStore = create<BootState>()(() => ({ hydrated: false, historyReady: false, storageBlocked: false, storageError: null }));

export function noteStorageFault(error: unknown): void {
  const appError = classify(error);
  useBootStore.setState((s) => (s.storageError === null ? { storageError: appError } : {}));
}
