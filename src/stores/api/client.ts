import { assertOnline, getConfig, onlineSignal } from '../core/config';
import { isRecord } from '../core/guards';
import { responseGet, responsePut } from '../core/idb';
import { sortedCopy } from '../core/sort';

import type { QueryParams } from '../core/types';
import type { CachedRead, EndpointKind, TaggedBytes } from './types';

const RETRIES = 3;
const UNREADABLE = Symbol('unreadable');
const BACKOFF_MS = 200;
const BACKOFF_MAX_MS = 2000;

const HOSTS: Record<EndpointKind, [string, string]> = {
  forecast: ['https://api.open-meteo.com', 'https://customer-api.open-meteo.com'],
  archive: ['https://archive-api.open-meteo.com', 'https://customer-archive-api.open-meteo.com'],
  air: ['https://air-quality-api.open-meteo.com', 'https://customer-air-quality-api.open-meteo.com'],
  marine: ['https://marine-api.open-meteo.com', 'https://customer-marine-api.open-meteo.com'],
  geo: ['https://geocoding-api.open-meteo.com', 'https://customer-geocoding-api.open-meteo.com'],
};

class ApiError extends Error {
  readonly retry: boolean;
  constructor(message: string, retry: boolean) {
    super(message);
    this.retry = retry;
  }
}

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

const sleep = async (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
  }, { once: true });
});

async function attempt(url: string, signal: AbortSignal): Promise<unknown> {
  const doFetch = getConfig().fetch ?? fetch;
  const res = await doFetch(url, { signal });
  const body: unknown = await res.json().catch(() => UNREADABLE);
  signal.throwIfAborted();
  if (res.ok && body === UNREADABLE) { throw new ApiError('Invalid JSON response', true); }
  if (res.ok && !(isRecord(body) && body.error === true)) { return body; }
  const reason = isRecord(body) && typeof body.reason === 'string' && body.reason !== '' ? body.reason : `HTTP ${String(res.status)}`;
  throw new ApiError(reason, res.status >= 500 || res.status === 429);
}

async function attemptBytes(url: string, signal: AbortSignal, headers: HeadersInit): Promise<TaggedBytes> {
  const doFetch = getConfig().fetch ?? fetch;
  const res = await doFetch(url, { signal, headers });
  if (!res.ok) { throw new ApiError(`HTTP ${String(res.status)}`, res.status >= 500 || res.status === 429); }
  const data = await res.arrayBuffer();
  signal.throwIfAborted();
  return { data, etag: res.headers.get('etag') ?? undefined };
}

const retryable = (error: unknown) => (error instanceof ApiError ? error.retry : error instanceof TypeError);

async function withRetries<T>(run: () => Promise<T>, signal: AbortSignal, round: number): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (round >= RETRIES || signal.aborted || !retryable(error)) { throw error; }
    await sleep(Math.min(BACKOFF_MS * 2 ** round, BACKOFF_MAX_MS), signal);
    return withRetries(run, signal, round + 1);
  }
}

export async function getJson(kind: EndpointKind, path: string, params: QueryParams, signal?: AbortSignal): Promise<unknown> {
  assertOnline();
  const url = requestUrl(kind, path, params);
  const live = onlineSignal(signal);
  return withRetries(async () => attempt(url, live), live, 0);
}

export async function getUrlJson(url: string, signal?: AbortSignal): Promise<unknown> {
  assertOnline();
  const live = onlineSignal(signal);
  return withRetries(async () => attempt(url, live), live, 0);
}

export async function getTaggedBytes(url: string, headers: HeadersInit = {}, signal?: AbortSignal): Promise<TaggedBytes> {
  assertOnline();
  const live = onlineSignal(signal);
  return withRetries(async () => attemptBytes(url, live, headers), live, 0);
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
  const now = Date.now();
  if (maxAgeMs > 0) {
    const hit = await responseGet(key).catch(() => null);
    const cached = hit !== null && now - hit.fetchedAt <= maxAgeMs ? fromCache(hit.body, build) : null;
    if (cached !== null) { return cached.value; }
  }
  const body = await getJson(kind, path, params);
  const value = build(body);
  void responsePut(key, { fetchedAt: now, expiresAt: now + Math.max(keepMs, maxAgeMs), body }).catch(() => null);
  return value;
}
