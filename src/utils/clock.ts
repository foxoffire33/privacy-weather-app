import { useSyncExternalStore } from 'react';

const TICK_MS = 30_000;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = Math.floor(Date.now() / TICK_MS) * (TICK_MS / 1000);

function tick(): void {
  now = Math.floor(Date.now() / TICK_MS) * (TICK_MS / 1000);
  for (const listener of listeners) { listener(); }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    tick();
    timer = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNowSeconds(): number {
  return useSyncExternalStore(subscribe, () => now);
}
