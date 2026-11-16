import { Box, Paper, Text } from '@mantine/core';

import { nowIndex, rainOutlook } from '../../utils/insights';

import { DayList } from './DayList';
import { HourlyStrip, Nowcast } from './HourlyStrip';

import type { OverviewCardProps } from '../../types';
import type { ReactElement } from 'react';

const OVERLAP = -36;
const GAP = 20;

export function OverviewCard({ city, entry, units, expanded, first }: OverviewCardProps): ReactElement {
  const data = { city, entry, units };
  return (
    <Paper className="glass" mx={12} mt={first ? OVERLAP : GAP} pos="relative">
      <Box px={12} pt={12} pb={10} style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <Text fz={14} fw={800}>{rainOutlook(entry.data, nowIndex(entry.data))}</Text>
        <Nowcast entry={entry} />
      </Box>
      <HourlyStrip {...data} expanded={expanded} />
      <DayList {...data} expanded={expanded} />
    </Paper>
  );
}
