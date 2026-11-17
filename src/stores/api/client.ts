import { noteFailure } from '../../utils/diagnostics';
import { ApiError, TimeoutError } from '../core/appError';
import { assertOnline, getConfig, onlineSignal } from '../core/config';
import { errorMessage } from '../core/errors';
import { isRecord } from '../core/guards';
import { responseGet, responsePut } from '../core/idb';
import { sortedCopy } from '../core/sort';

import type { CombinedSignal } from '../core/config';
import type { QueryParams } from '../core/types';
import type { CachedRead, EndpointKind, TaggedBytes } from './types';

const RETRIES = 3;
const UNREADABLE = Symbol('unreadable');
const BACKOFF_MS = 200;
const BACKOFF_MAX_MS = 2000;
const ATTEMPT_TIMEOUT_MS = 30_000;
const RETRY_AFTER_MAX_MS = 60_000;

const HOSTS: Record<EndpointKind, [string, string]> = {
  forecast: ['https://api.open-meteo.com', 'https://customer-api.open-meteo.com'],
  archive: ['https://archive-api.open-meteo.com', 'https://customer-archive-api.open-meteo.com'],
  air: ['https://air-quality-api.open-meteo.com', 'https://customer-air-quality-api.open-meteo.com'],
  marine: ['https://marine-api.open-meteo.com', 'https://customer-marine-api.open-meteo.com'],
  geo: ['https://geocoding-api.open-meteo.com', 'https://customer-geocoding-api.open-meteo.com'],
};

function base(kind: EndpointKind): string {
  const { apiKey, server } = getConfig();
  if (kind === 'forecast' && server !== '') { return server.replace(/\/$/, ''); }
  return HOSTS[kind][apiKey === '' ? 0 : 1];
}

function query(params: QueryParams): URLSearchParams {
  const q = new URLSearchParams();
  for (const key of sortedCopy(Object.keys(params), (a, b) => a.localeCompare(b))) {
    const value = params[key];
    if (value === undefined) { continue; }
    q.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return q;
}

export function cacheKey(kind: EndpointKind, path: string, params: QueryParams): string {
  return `${base(kind)}${path}?${query(params).toString()}`;
}

function requestUrl(kind: EndpointKind, path: string, params: QueryParams): string {
  const { apiKey } = getConfig();
  return cacheKey(kind, path, apiKey === '' ? params : { ...params, apikey: apiKey });
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) { onAbort(); }
  });
}

function timedSignal(user: AbortSignal): CombinedSignal {
  const both = new AbortController();
  const timer = setTimeout(() => { both.abort(new TimeoutError()); }, ATTEMPT_TIMEOUT_MS);
  const onAbort = (): void => { both.abort(user.reason); };
  user.addEventListener('abort', onAbort, { once: true });
  if (user.aborted) { onAbort(); }
  return {
    signal: both.signal,
    dispose: (): void => {
      clearTimeout(timer);
      user.removeEventListener('abort', onAbort);
    },
  };
}

async function attempt(url: string, signal: AbortSignal): Promise<unknown> {
  const live = timedSignal(signal);
  try {
    const doFetch = getConfig().fetch ?? fetch;
    const res = await doFetch(url, { signal: live.signal });
    const body: unknown = await res.json().catch(() => UNREADABLE);
    live.signal.throwIfAborted();
    if (res.ok && body === UNREADABLE) { throw new ApiError('Invalid JSON response', res.status, true, 0); }
    if (res.ok && !(isRecord(body) && body.error === true)) { return body; }
    const retry = res.status >= 500 || res.status === 429;
    const reason = isRecord(body) && typeof body.reason === 'string' && body.reason !== '' ? body.reason : `HTTP ${String(res.status)}`;
    throw new ApiError(reason, res.status, retry, retryAfterMs(res));
  } finally {
    live.dispose();
  }
}

async function attemptBytes(url: string, signal: AbortSignal, headers: HeadersInit): Promise<TaggedBytes> {
  const live = timedSignal(signal);
  try {
    const doFetch = getConfig().fetch ?? fetch;
    const res = await doFetch(url, { signal: live.signal, headers });
    if (!res.ok) { throw new ApiError(`HTTP ${String(res.status)}`, res.status, res.status >= 500 || res.status === 429, retryAfterMs(res)); }
    const data = await res.arrayBuffer();
    live.signal.throwIfAborted();
    return { data, etag: res.headers.get('etag') ?? undefined };
  } finally {
    live.dispose();
  }
}

function retryAfterMs(res: Response): number {
  const header = res.headers.get('retry-after');
  if (header === null) { return 0; }
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  if (!Number.isFinite(ms) || ms < 0) { return 0; }
  return Math.min(ms, RETRY_AFTER_MAX_MS);
}

const retryable = (error: unknown): boolean => (error instanceof ApiError ? error.retry : error instanceof TypeError || error instanceof TimeoutError);

const jitter = (ms: number): number => ms * (0.5 + Math.random() * 0.5);

async function withRetries<T>(run: () => Promise<T>, signal: AbortSignal, round: number): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (round >= RETRIES || signal.aborted || !retryable(error)) { throw error; }
    const backoff = jitter(Math.min(BACKOFF_MS * 2 ** round, BACKOFF_MAX_MS));
    const delay = error instanceof ApiError ? Math.max(backoff, error.delayMs) : backoff;
    await sleep(delay, signal);
    return withRetries(run, signal, round + 1);
  }
}

export async function getJson(kind: EndpointKind, path: string, params: QueryParams, signal?: AbortSignal): Promise<unknown> {
  assertOnline();
  const url = requestUrl(kind, path, params);
  const live = onlineSignal(signal);
  try {
    return await withRetries(async () => attempt(url, live.signal), live.signal, 0);
  } finally {
    live.dispose();
  }
}

export async function getUrlJson(url: string, signal?: AbortSignal): Promise<unknown> {
  assertOnline();
  const live = onlineSignal(signal);
  try {
    return await withRetries(async () => attempt(url, live.signal), live.signal, 0);
  } finally {
    live.dispose();
  }
}

export async function getTaggedBytes(url: string, headers: HeadersInit = {}, signal?: AbortSignal): Promise<TaggedBytes> {
  assertOnline();
  const live = onlineSignal(signal);
  try {
    return await withRetries(async () => attemptBytes(url, live.signal, headers), live.signal, 0);
  } finally {
    live.dispose();
  }
}

export async function getBytes(url: string, headers: HeadersInit = {}, signal?: AbortSignal): Promise<ArrayBuffer> {
  const { data } = await getTaggedBytes(url, headers, signal);
  return data;
}

function fromCache<T>(body: unknown, build: (json: unknown) => T): { value: T } | null {
  try {
    return { value: build(body) };
  } catch {
    return null;
  }
}

export async function cachedJson<T>(kind: EndpointKind, path: string, params: QueryParams, read: CachedRead<T>): Promise<T> {
  const { maxAgeMs, keepMs = maxAgeMs, build } = read;
  const key = cacheKey(kind, path, params);
  if (maxAgeMs > 0) {
    const hit = await responseGet(key).catch((error: unknown) => { noteFailure('response-cache read', errorMessage(error)); });
    const cached = hit !== undefined && Date.now() - hit.fetchedAt <= maxAgeMs ? fromCache(hit.body, build) : null;
    if (cached !== null) { return cached.value; }
  }
  const body = await getJson(kind, path, params);
  const value = build(body);
  const fetchedAt = Date.now();
  void responsePut(key, { fetchedAt, expiresAt: fetchedAt + Math.max(keepMs, maxAgeMs), body }).catch((error: unknown) => { noteFailure('response-cache write', errorMessage(error)); });
  return value;
}
