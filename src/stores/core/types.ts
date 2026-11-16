
export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QueryState {
  status: QueryStatus;
  error: string | null;
  lastLoadedAt: number | null;
}

export function initialQueryState(): QueryState {
  return { status: 'idle', error: null, lastLoadedAt: null };
}

export const IDLE_QUERY: QueryState = Object.freeze({ status: 'idle', error: null, lastLoadedAt: null });

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
  radarServer: string;
  mapServer: string;
  fetch: typeof fetch | null;
  offline: boolean;
}

export interface PendingWrite {
  value: unknown;
  timer: ReturnType<typeof setTimeout>;
}

export interface Rehydratable extends HydratablePersist {
  persist: HydratablePersist['persist'] & RehydrateHandle;
}

export interface RehydrateHandle {
  rehydrate: () => Promise<void> | void;
}

export type Pending = PromiseLike<void>;

export type IdbEntry = [string, unknown];

export interface ResponseRecord {
  fetchedAt: number;
  expiresAt: number;
  body: unknown;
}

export type QueryValue = string | number | boolean | readonly string[] | undefined;

export type QueryParams = Readonly<Record<string, QueryValue>>;

export interface MapStore<S> {
  subscribe: (listener: (state: S, prev: S) => void) => () => void;
}

export type BlockedListener = (blocked: boolean) => void;
export type MarkListener = (name: string, start: number, duration: number) => void;

export type ConfigListener = (config: DataLayerConfig) => void;

export type WorkerConfig = Pick<DataLayerConfig, 'apiKey' | 'server' | 'radarServer' | 'mapServer' | 'offline'>;

