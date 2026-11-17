import { describe, expect, it } from 'vitest';

import { settleError, succeed } from '../../factory/queryState';
import { ApiError, AppError, classify, TimeoutError } from '../appError';
import { OFFLINE } from '../config';
import { StorageError } from '../idb';
import { IDLE_QUERY } from '../types';

const timeoutError = (): AppError => new AppError({ code: 'network.timeout', messageKey: 'errors.timeout', retryable: true });
const cancelledError = (): AppError => new AppError({ code: 'operation.cancelled', messageKey: 'errors.cancelled', retryable: false });

describe('classify', () => {
  it('maps an offline error to network.offline without retry', () => {
    const error = new Error(OFFLINE);
    expect(classify(error)).toMatchObject({ code: 'network.offline', messageKey: 'errors.offline', retryable: false, status: null, op: null });
    expect(classify(error).cause).toBe(error);
  });

  it('maps a timeout to network.timeout with retry', () => {
    expect(classify(new TimeoutError())).toMatchObject({ code: 'network.timeout', messageKey: 'errors.timeout', retryable: true });
  });

  it('maps a rate limit to network.http with the rate-limit message', () => {
    expect(classify(new ApiError('HTTP 429', 429, true, 0))).toMatchObject({ code: 'network.http', messageKey: 'errors.rateLimited', retryable: true, status: 429 });
  });

  it('maps a server error to network.http with retry', () => {
    expect(classify(new ApiError('HTTP 503', 503, true, 0))).toMatchObject({ code: 'network.http', messageKey: 'errors.server', retryable: true, status: 503 });
  });

  it('maps a client error to network.http without retry', () => {
    expect(classify(new ApiError('HTTP 400', 400, false, 0))).toMatchObject({ code: 'network.http', messageKey: 'errors.client', retryable: false, status: 400 });
  });

  it('maps an unreadable response to network.invalid-response', () => {
    expect(classify(new ApiError('Invalid JSON response', 0, true, 0))).toMatchObject({ code: 'network.invalid-response', messageKey: 'errors.invalidResponse', retryable: true, status: null });
  });

  it('maps storage errors to the matching code and operation', () => {
    expect(classify(new StorageError('quota-exceeded', 'full'))).toMatchObject({ code: 'storage.quota-exceeded', messageKey: 'errors.quota', retryable: false, op: 'quota-exceeded' });
    expect(classify(new StorageError('write-failed', 'write'))).toMatchObject({ code: 'storage.write-failed', messageKey: 'errors.storageWrite', retryable: true, op: 'write-failed' });
    expect(classify(new StorageError('blocked', 'blocked'))).toMatchObject({ code: 'storage.unavailable', messageKey: 'errors.storageUnavailable', retryable: true });
  });

  it('maps an abort to operation.cancelled without retry', () => {
    expect(classify(new DOMException('aborted', 'AbortError'))).toMatchObject({ code: 'operation.cancelled', messageKey: 'errors.cancelled', retryable: false });
  });

  it('maps anything else to unknown and keeps the original cause', () => {
    const error = new TypeError('fetch failed');
    const appError = classify(error);
    expect(appError).toMatchObject({ code: 'unknown', messageKey: 'errors.unknown', retryable: false });
    expect(appError.cause).toBe(error);
  });

  it('keeps an already classified error as-is', () => {
    const appError = new AppError({ code: 'unknown', messageKey: 'errors.unknown', retryable: false });
    expect(classify(appError)).toBe(appError);
  });

  it('carries the correlation id when given', () => {
    expect(classify(new TimeoutError(), 'city:demo')).toMatchObject({ id: 'city:demo' });
    expect(classify(new TimeoutError()).id).toBe(null);
  });
});

describe('settleError', () => {
  it('fails the query with the classified error', () => {
    const settled = settleError(IDLE_QUERY, timeoutError());
    expect(settled.status).toBe('error');
    expect(settled.error).toMatchObject({ code: 'network.timeout' });
  });

  it('drops the error on cancellation when no data was loaded', () => {
    expect(settleError(IDLE_QUERY, cancelledError())).toEqual({ status: 'idle', error: null, lastLoadedAt: null });
  });

  it('keeps the last good state on cancellation when data was loaded', () => {
    const settled = settleError(succeed(), cancelledError());
    expect(settled.status).toBe('success');
    expect(settled.error).toBeNull();
    expect(settled.lastLoadedAt).not.toBeNull();
  });
});
