import { Box, UnstyledButton } from '@mantine/core';

import { NO_HIDDEN } from '../../lib/series';
import { useUiStore } from '../../stores/uiStore';

import type { SeriesLegendProps } from '../../types';
import type { ReactElement } from 'react';

export function SeriesLegend({ scope, series }: SeriesLegendProps): ReactElement {
  const hidden = useUiStore((s) => s.hiddenSeries[scope] ?? NO_HIDDEN);
  const toggle = useUiStore((s) => s.toggleSeries);
  return (
    <Box className="toggle-legend">
      {series.map((s) => (
        <UnstyledButton key={s.name} aria-pressed={!hidden.includes(s.name)} onClick={() => { toggle(scope, s.name); }}>
          <Box component="i" style={{ background: `var(--mantine-color-${s.color.replace('.', '-')})` }} />{s.label ?? s.name}
        </UnstyledButton>
      ))}
    </Box>
  );
}
