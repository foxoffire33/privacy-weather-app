import { OFFLINE } from './config';
import { isAbort } from './errors';
import { RETRYABLE_WRITE_CODES, isStorageError } from './idb';

import type { MessageKey } from '../../types';
import type { StorageErrorCode } from './idb';

export type AppErrorCode =
  | 'network.offline'
  | 'network.timeout'
  | 'network.http'
  | 'network.invalid-response'
  | 'storage.unavailable'
  | 'storage.quota-exceeded'
  | 'storage.read-failed'
  | 'storage.write-failed'
  | 'storage.transaction-aborted'
  | 'data.validation-failed'
  | 'backup.unsupported-version'
  | 'operation.cancelled'
  | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly messageKey: MessageKey;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly op: string | null;
  readonly id: string | null;

  constructor(init: {
    code: AppErrorCode;
    messageKey: MessageKey;
    retryable: boolean;
    cause?: unknown;
    status?: number;
    op?: string;
    id?: string | null;
  }) {
    super(init.messageKey, { cause: init.cause });
    this.name = 'AppError';
    this.code = init.code;
    this.messageKey = init.messageKey;
    this.retryable = init.retryable;
    this.status = init.status ?? null;
    this.op = init.op ?? null;
    this.id = init.id ?? null;
  }
}

export class ApiError extends Error {
  readonly retry: boolean;
  readonly status: number;
  readonly delayMs: number;
  constructor(message: string, status: number, retry: boolean, delayMs: number) {
    super(message);
    this.status = status;
    this.retry = retry;
    this.delayMs = delayMs;
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Request timed out');
  }
}

const STORAGE_CODE: Record<StorageErrorCode, AppErrorCode> = {
  unavailable: 'storage.unavailable',
  'open-failed': 'storage.unavailable',
  blocked: 'storage.unavailable',
  'read-failed': 'storage.read-failed',
  'write-failed': 'storage.write-failed',
  'quota-exceeded': 'storage.quota-exceeded',
  'transaction-aborted': 'storage.transaction-aborted',
  'corrupt-data': 'storage.read-failed',
};

const STORAGE_MESSAGE: Record<StorageErrorCode, MessageKey> = {
  unavailable: 'errors.storageUnavailable',
  'open-failed': 'errors.storageUnavailable',
  blocked: 'errors.storageUnavailable',
  'read-failed': 'errors.storageRead',
  'write-failed': 'errors.storageWrite',
  'quota-exceeded': 'errors.quota',
  'transaction-aborted': 'errors.storageAborted',
  'corrupt-data': 'errors.storageRead',
};

interface AppErrorDetail {
  retryable: boolean;
  status?: number;
  op?: string;
  id?: string | null;
}

const appError = (code: AppErrorCode, messageKey: MessageKey, cause: unknown, detail: AppErrorDetail): AppError =>
  new AppError({ code, messageKey, cause, ...detail });

export function classify(error: unknown, id: string | null = null): AppError {
  if (error instanceof AppError) { return error; }
  if (isStorageError(error)) {
    return appError(STORAGE_CODE[error.code], STORAGE_MESSAGE[error.code], error, { retryable: RETRYABLE_WRITE_CODES.has(error.code), op: error.code, id });
  }
  if (error instanceof TimeoutError) {
    return appError('network.timeout', 'errors.timeout', error, { retryable: true, id });
  }
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return appError('network.invalid-response', 'errors.invalidResponse', error, { retryable: error.retry, id });
    }
    if (error.status === 429) {
      return appError('network.http', 'errors.rateLimited', error, { retryable: true, status: error.status, id });
    }
    const message: MessageKey = error.status >= 500 ? 'errors.server' : 'errors.client';
    return appError('network.http', message, error, { retryable: error.retry, status: error.status, id });
  }
  if (error instanceof Error && error.message === OFFLINE) {
    return appError('network.offline', 'errors.offline', error, { retryable: false, id });
  }
  if (isAbort(error)) {
    return appError('operation.cancelled', 'errors.cancelled', error, { retryable: false, id });
  }
  return appError('unknown', 'errors.unknown', error, { retryable: false, id });
}
