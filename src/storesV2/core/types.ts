export type EntityId = string;

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QueryState {
  status: QueryStatus;
  error: string | null;
  lastLoadedAt: number | null;
}

export function initialQueryState(): QueryState {
  return { status: 'idle', error: null, lastLoadedAt: null };
}

export type QueryMap = Record<string, QueryState>;

export interface HydratablePersist {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}

export interface DataLayerConfig {
  apiKey: string;
  server: string;
  fetch: typeof fetch | null;
}
