import type { MarkListener } from './types';

let listener: MarkListener | null = null;

export function onMeasure(fn: MarkListener | null): void {
  listener = fn;
}

export async function measure<T>(name: string, task: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await task();
  } finally {
    const duration = performance.now() - start;
    listener?.(name, start, duration);
  }
}

async function settle(value: unknown): Promise<void> {
  await value;
}

export async function yieldToMain(): Promise<void> {
  const scheduler: unknown = Reflect.get(globalThis, 'scheduler');
  const run: unknown = typeof scheduler === 'object' && scheduler !== null ? Reflect.get(scheduler, 'yield') : undefined;
  if (typeof run === 'function') {
    return settle(Reflect.apply(run, scheduler, []));
  }
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

export function whenIdle(task: () => void): void {
  const idle: unknown = Reflect.get(globalThis, 'requestIdleCallback');
  if (typeof idle === 'function') {
    Reflect.apply(idle, globalThis, [task, { timeout: 1500 }]);
  } else {
    setTimeout(task, 200);
  }
}
