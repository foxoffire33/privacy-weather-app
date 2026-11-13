import type { DataLayerConfig } from './types';

function createDefaultConfig(): DataLayerConfig {
  return { apiKey: '', server: '', fetch: null };
}

let current: DataLayerConfig = createDefaultConfig();

export function configureDataLayer(partial: Partial<DataLayerConfig>): void {
  current = { ...current, ...partial };
}

export function getConfig(): DataLayerConfig {
  return current;
}
