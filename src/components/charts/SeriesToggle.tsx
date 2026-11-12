import { useState } from 'react';

export interface ToggleSeries { name: string; color: string; strokeDasharray?: string }

// Click-to-toggle legend. Mantine's own legend is not interactive, so charts pass withLegend={false}
// and draw only the series that are not switched off.
export function useSeriesToggle(scope: string) {
  const [off, setOff] = useState<Set<string>>(new Set());
  const key = (name: string) => `${scope}:${name}`;
  return {
    visible: <T extends { name: string }>(series: T[]) => series.filter((s) => !off.has(key(s.name))),
    legend: (series: ToggleSeries[]) => (
      <div className="toggle-legend">
        {series.map((s) => (
          <button key={s.name} type="button" aria-pressed={!off.has(key(s.name))}
            onClick={() => setOff((prev) => { const next = new Set(prev); const k = key(s.name); if (!next.delete(k)) next.add(k); return next; })}>
            <i style={{ background: `var(--mantine-color-${s.color.replace('.', '-')})` }} />{s.name}
          </button>
        ))}
      </div>
    ),
  };
}
