import { describe, expect, it } from 'vitest';

import { guard, restoreError, serializeError } from '../api/workerResult';
import { ApiError, TimeoutError, classify } from '../core/appError';
import { OFFLINE } from '../core/config';
import { isAbort } from '../core/errors';

const failingRateLimited = async (): Promise<never> => {
  await Promise.resolve();
  throw new ApiError('HTTP 429', 429, true, 1000);
};
const failingGrid = async (): Promise<never> => {
  await Promise.resolve();
  throw new Error('Incomplete model grid');
};
const doubling = async (n: number): Promise<number> => {
  await Promise.resolve();
  return n * 2;
};

describe('worker error bridge', () => {
  it('keeps every ApiError field in the serialized payload', () => {
    expect(serializeError(new ApiError('HTTP 429', 429, true, 1500)))
      .toEqual({ kind: 'api', message: 'HTTP 429', status: 429, retry: true, delayMs: 1500 });
  });

  it('round-trips a 429 into the rate-limit message and a 5xx into the server message', () => {
    expect(classify(restoreError(serializeError(new ApiError('HTTP 429', 429, true, 1500)))).messageKey).toBe('errors.rateLimited');
    expect(classify(restoreError(serializeError(new ApiError('HTTP 503', 503, true, 0)))).messageKey).toBe('errors.server');
  });

  it('round-trips a TimeoutError into the timeout code', () => {
    const restored = restoreError(serializeError(new TimeoutError()));
    expect(restored).toBeInstanceOf(TimeoutError);
    expect(classify(restored).code).toBe('network.timeout');
  });

  it('keeps an offline error classifiable after the round trip', () => {
    const restored = restoreError(serializeError(new Error(OFFLINE)));
    expect(classify(restored).code).toBe('network.offline');
  });

  it('keeps an abort classifiable after the round trip', () => {
    const restored = restoreError(serializeError(new DOMException('aborted', 'AbortError')));
    expect(isAbort(restored)).toBe(true);
    expect(classify(restored).code).toBe('operation.cancelled');
  });

  it('passes a resolved value through unchanged', async () => {
    await expect(guard(doubling)(21)).resolves.toEqual({ ok: true, value: 42 });
  });

  it('turns a rejected ApiError into a serializable failure', async () => {
    const payload = serializeError(new ApiError('HTTP 429', 429, true, 1000));
    const result = await guard(failingRateLimited)();
    expect(result).toEqual({ ok: false, error: payload });
    expect(restoreError(payload)).toBeInstanceOf(ApiError);
  });

  it('serializes an untyped throw without crashing', async () => {
    const result = await guard(failingGrid)();
    expect(result).toEqual({ ok: false, error: { kind: 'error', name: 'Error', message: 'Incomplete model grid' } });
  });
});
