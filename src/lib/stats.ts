const nums = (a?: (number | null)[]): number[] => (a ?? []).filter((x): x is number => x !== null);

export const avg = (a?: (number | null)[]): number | null => {
  const n = nums(a);
  let sum = 0;
  for (const x of n) { sum += x; }
  return n.length > 0 ? sum / n.length : null;
};

export const max = (a?: (number | null)[]): number | null => {
  const n = nums(a);
  return n.length > 0 ? Math.max(...n) : null;
};

export const min = (a?: (number | null)[]): number | null => {
  const n = nums(a);
  return n.length > 0 ? Math.min(...n) : null;
};

export const fixed = (v: number | null | undefined, digits = 0): string => (v === null || v === undefined ? '–' : v.toFixed(digits));
