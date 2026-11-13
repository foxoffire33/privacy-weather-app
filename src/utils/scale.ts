import type { Step } from '../types';

export function below<T>(value: number, steps: readonly Step<T>[], last: T): T {
  for (const [limit, out] of steps) {
    if (value < limit) { return out; }
  }
  return last;
}

export function atMost<T>(value: number, steps: readonly Step<T>[], last: T): T {
  for (const [limit, out] of steps) {
    if (value <= limit) { return out; }
  }
  return last;
}
