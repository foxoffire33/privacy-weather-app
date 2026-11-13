import type { CSSProperties } from 'react';
import { Box, UnstyledButton } from '@mantine/core';
import { useSet } from '@mantine/hooks';

export interface ToggleSeries { name: string; label?: string; color: string }

export function useSeriesToggle(scope: string) {
  const off = useSet<string>();
  const key = (name: string) => `${scope}:${name}`;
  const toggle = (name: string) => { const k = key(name); if (!off.delete(k)) off.add(k); };
  return {
    visible: <T extends { name: string }>(series: T[]) => series.filter((s) => !off.has(key(s.name))),
    legend: (series: ToggleSeries[]) => (
      <Box className="toggle-legend">
        {series.map((s) => (
          <UnstyledButton key={s.name} aria-pressed={!off.has(key(s.name))}
            onClick={() => toggle(s.name)}>
            <Box component="i" style={{ '--swatch-c': `var(--mantine-color-${s.color.replace('.', '-')})` } as CSSProperties} />{s.label ?? s.name}
          </UnstyledButton>
        ))}
      </Box>
    ),
  };
}
