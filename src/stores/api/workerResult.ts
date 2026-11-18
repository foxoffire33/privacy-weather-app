import { ApiError, TimeoutError } from '../core/appError';

export type SerializedError =
  | { kind: 'api'; message: string; status: number; retry: boolean; delayMs: number }
  | { kind: 'timeout' }
  | { kind: 'error'; name: string; message: string };

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: SerializedError };

export function serializeError(error: unknown): SerializedError {
  try {
    if (error instanceof ApiError) {
      return { kind: 'api', message: error.message, status: error.status, retry: error.retry, delayMs: error.delayMs };
    }
    if (error instanceof TimeoutError) { return { kind: 'timeout' }; }
    if (error instanceof Error) { return { kind: 'error', name: error.name, message: error.message }; }
    return { kind: 'error', name: 'Error', message: String(error) };
  } catch {
    return { kind: 'error', name: 'Error', message: 'Unserializable error' };
  }
}

export function restoreError(error: SerializedError): Error {
  if (error.kind === 'api') { return new ApiError(error.message, error.status, error.retry, error.delayMs); }
  if (error.kind === 'timeout') { return new TimeoutError(); }
  const restored = new Error(error.message);
  restored.name = error.name;
  return restored;
}

export function guard<A extends unknown[], T>(fn: (...args: A) => Promise<T>): (...args: A) => Promise<ApiResult<T>> {
  return async (...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (error) {
      return { ok: false, error: serializeError(error) };
    }
  };
}
