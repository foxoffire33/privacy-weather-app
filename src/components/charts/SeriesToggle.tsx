import { Box, UnstyledButton } from '@mantine/core';
import { useState } from 'react';

export interface ToggleSeries { name: string; label?: string; color: string }

export function useSeriesToggle(scope: string) {
  const [off, setOff] = useState<Set<string>>(new Set());
  const key = (name: string) => `${scope}:${name}`;
  return {
    visible: <T extends { name: string }>(series: T[]) => series.filter((s) => !off.has(key(s.name))),
    legend: (series: ToggleSeries[]) => (
      <Box className="toggle-legend">
        {series.map((s) => (
          <UnstyledButton key={s.name} type="button" aria-pressed={!off.has(key(s.name))}
            onClick={() => setOff((prev) => { const next = new Set(prev); const k = key(s.name); if (!next.delete(k)) next.add(k); return next; })}>
            <Box component="i" style={{ background: `var(--mantine-color-${s.color.replace('.', '-')})` }} />{s.label ?? s.name}
          </UnstyledButton>
        ))}
      </Box>
    ),
  };
}
