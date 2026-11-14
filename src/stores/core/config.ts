import type { DataLayerConfig } from './types';

function createDefaultConfig(): DataLayerConfig {
  return { apiKey: '', server: '', fetch: null, offline: false };
}

let current: DataLayerConfig = createDefaultConfig();

export function configureDataLayer(partial: Partial<DataLayerConfig>): void {
  current = { ...current, ...partial };
}

export const OFFLINE = 'offline-mode';

export function isOffline(): boolean {
  return current.offline;
}

export function assertOnline(): void {
  if (current.offline) { throw new Error(OFFLINE); }
}

export function getConfig(): DataLayerConfig {
  return current;
}
