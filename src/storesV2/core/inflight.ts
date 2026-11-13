const running = new Map<string, Promise<void>>();
const settled = new Map<string, Promise<void>>();

const settle = (): void => undefined;

export const READY: Promise<void> = Object.assign(Promise.resolve(), { status: 'fulfilled', value: undefined });

export function once(key: string, run: () => Promise<unknown>): Promise<void> {
  const pending = running.get(key);
  if (pending !== undefined) return pending;
  const promise = Promise.resolve().then(run).then(settle, settle);
  running.set(key, promise);
  void promise.then(() => {
    running.delete(key);
    settled.set(key, promise);
  });
  return promise;
}

export function lastSettled(key: string): Promise<void> {
  return settled.get(key) ?? READY;
}

export function latest(key: string): Promise<void> {
  return running.get(key) ?? settled.get(key) ?? READY;
}
