import type { ConfigListener, DataLayerConfig } from './types';

function createDefaultConfig(): DataLayerConfig {
  return { apiKey: '', server: '', radarServer: '', mapServer: '', fetch: null, offline: false };
}

export const OFFLINE = 'offline-mode';

let current: DataLayerConfig = createDefaultConfig();
let online = new AbortController();
const listeners = new Set<ConfigListener>();

export function configureDataLayer(partial: Partial<DataLayerConfig>): void {
  const wasOffline = current.offline;
  current = { ...current, ...partial };
  if (current.offline && !wasOffline) {
    online.abort(new Error(OFFLINE));
    online = new AbortController();
  }
  for (const listener of listeners) { listener(current); }
}

export function onConfigure(listener: ConfigListener): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}

export interface CombinedSignal {
  signal: AbortSignal;
  dispose: () => void;
}

export function onlineSignal(signal?: AbortSignal): CombinedSignal {
  const both = new AbortController();
  const sources: AbortSignal[] = signal === undefined ? [online.signal] : [signal, online.signal];
  const unlisteners: (() => void)[] = [];
  for (const source of sources) {
    if (source.aborted) {
      both.abort(source.reason);
      continue;
    }
    const stop = (): void => { both.abort(source.reason); };
    source.addEventListener('abort', stop, { once: true });
    unlisteners.push(() => { source.removeEventListener('abort', stop); });
  }
  return {
    signal: both.signal,
    dispose: (): void => {
      for (const remove of unlisteners) { remove(); }
    },
  };
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
