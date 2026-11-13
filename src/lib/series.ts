import type { Named } from '../types';

export const NO_HIDDEN: readonly string[] = [];

export function visibleSeries<T extends Named>(series: readonly T[], hidden: readonly string[]): T[] {
  return series.filter((s) => !hidden.includes(s.name));
}
