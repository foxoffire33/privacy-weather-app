import type { Pending } from './types';

const running = new Map<string, Promise<void>>();

const settle = (): void => undefined;

export const READY: Promise<void> = Object.assign(Promise.resolve(), { status: 'fulfilled', value: undefined });

export function once(key: string, run: () => Promise<unknown>): Pending {
  const pending = running.get(key);
  if (pending !== undefined) { return pending; }
  const promise = Promise.resolve().then(run).then(settle, settle);
  running.set(key, promise);
  void promise.then(() => { running.delete(key); });
  return promise;
}

export function latest(key: string): Pending {
  return running.get(key) ?? READY;
}
