import { Box, UnstyledButton } from '@mantine/core';

import { useUiStore } from '../../stores/uiStore';

import type { Named, SeriesToggleApi, ToggleSeries } from '../../types';

const NONE: string[] = [];

export function useSeriesToggle(scope: string): SeriesToggleApi {
  const hidden = useUiStore((s) => s.hiddenSeries[scope] ?? NONE);
  const toggle = useUiStore((s) => s.toggleSeries);
  return {
    visible: <T extends Named>(series: T[]) => series.filter((s) => !hidden.includes(s.name)),
    legend: (series: ToggleSeries[]) => (
      <Box className="toggle-legend">
        {series.map((s) => (
          <UnstyledButton key={s.name} aria-pressed={!hidden.includes(s.name)} onClick={() => { toggle(scope, s.name); }}>
            <Box component="i" style={{ background: `var(--mantine-color-${s.color.replace('.', '-')})` }} />{s.label ?? s.name}
          </UnstyledButton>
        ))}
      </Box>
    ),
  };
}
