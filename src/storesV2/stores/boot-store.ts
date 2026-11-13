import { create } from 'zustand';
import type { BootState } from './types';

export type { BootState } from './types';

export const useBootStore = create<BootState>()(() => ({ hydrated: false }));
