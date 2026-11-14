import type { DataLayerConfig } from './types';

function createDefaultConfig(): DataLayerConfig {
  return { apiKey: '', server: '', fetch: null, offline: false };
}

export const OFFLINE = 'offline-mode';

let current: DataLayerConfig = createDefaultConfig();
let online = new AbortController();

export function configureDataLayer(partial: Partial<DataLayerConfig>): void {
  const wasOffline = current.offline;
  current = { ...current, ...partial };
  if (current.offline && !wasOffline) {
    online.abort(new Error(OFFLINE));
    online = new AbortController();
  }
}

export function onlineSignal(signal?: AbortSignal): AbortSignal {
  if (signal === undefined) { return online.signal; }
  const both = new AbortController();
  const stop = () => { both.abort(); };
  for (const s of [signal, online.signal]) {
    if (s.aborted) { both.abort(); }
    s.addEventListener('abort', stop, { once: true });
  }
  return both.signal;
}

export function isOffline(): boolean {
  return current.offline;
}

export function assertOnline(): void {
  if (current.offline) { throw new Error(OFFLINE); }
}

export function getConfig(): DataLayerConfig {
  return current;
}
