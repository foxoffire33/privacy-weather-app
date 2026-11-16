import { create } from 'zustand';

import { errorMessage } from './core/errors';

import type { BootState } from './storeTypes';

export const useBootStore = create<BootState>()(() => ({ hydrated: false, historyReady: false, storageBlocked: false, storageError: null }));

export function noteStorageFault(error: unknown): void {
  useBootStore.setState((s) => s.storageError === null ? { storageError: errorMessage(error) } : {});
}
