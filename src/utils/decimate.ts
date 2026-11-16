import { shortDate } from './format';

import type { ChartRow, Aggregate } from '../types';

export const MAX_POINTS = 180;

function combine(values: readonly (number | null)[], how: Aggregate): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) { return null; }
  const total = present.reduce((a, b) => a + b, 0);
  return Math.round((how === 'sum' ? total : total / present.length) * 10) / 10;
}

export function decimate(rows: readonly ChartRow[], dates: readonly string[], how: (key: string) => Aggregate): ChartRow[] {
  if (rows.length <= MAX_POINTS) { return [...rows]; }
  const size = Math.ceil(rows.length / MAX_POINTS);
  const out: ChartRow[] = [];
  for (let start = 0; start < rows.length; start += size) {
    const bin = rows.slice(start, start + size);
    const first = dates[start] ?? '';
    const last = dates[Math.min(start + size, rows.length) - 1] ?? first;
    const row: ChartRow = { label: shortDate(first), when: `${shortDate(first)} – ${shortDate(last)}` };
    for (const key of Object.keys(bin[0] ?? {})) {
      if (key === 'label' || key === 'when') { continue; }
      row[key] = combine(bin.map((r) => (typeof r[key] === 'number' ? r[key] : null)), how(key));
    }
    out.push(row);
  }
  return out;
}
