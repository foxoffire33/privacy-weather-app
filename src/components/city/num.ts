export const n0 = (v: number | null | undefined, digits = 0): string => (v === null || v === undefined ? '–' : v.toFixed(digits));
