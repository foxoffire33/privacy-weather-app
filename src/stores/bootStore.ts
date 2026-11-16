import { create } from 'zustand';

import type { BootState } from './storeTypes';

export const useBootStore = create<BootState>()(() => ({ hydrated: false, historyReady: false, storageBlocked: false, storageError: null }));
