import { IDLE_QUERY } from '../core/types';

import type { AppError } from '../core/appError';
import type { QueryMap, QueryState } from '../core/types';




export function begin(q: QueryState): QueryState {
  return { ...q, status: 'loading', error: null };
}

export function succeed(): QueryState {
  return { status: 'success', error: null, lastLoadedAt: Date.now() };
}

export function fail(q: QueryState, error: AppError): QueryState {
  return { ...q, status: 'error', error };
}

export function cancel(q: QueryState): QueryState {
  return q.lastLoadedAt === null ? { status: 'idle', error: null, lastLoadedAt: null } : { ...q, status: 'success', error: null };
}

export function settleError(q: QueryState, error: AppError): QueryState {
  return error.code === 'operation.cancelled' ? cancel(q) : fail(q, error);
}

export function isLoading(q: QueryState | undefined): boolean {
  return q?.status === 'loading';
}

const STALE_MS = 10 * 60 * 1000;

export function isFresh(q: QueryState | undefined, staleMs = STALE_MS): boolean {
  return q?.status === 'success' && q.lastLoadedAt !== null && Date.now() - q.lastLoadedAt < staleMs;
}

export function queryAt(map: QueryMap, key: string): QueryState {
  return map[key] ?? IDLE_QUERY;
}

export function setQuery(map: QueryMap, key: string, q: QueryState): QueryMap {
  return { ...map, [key]: q };
}
