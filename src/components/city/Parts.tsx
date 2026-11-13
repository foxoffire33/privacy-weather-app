import { Box, Group, Progress, Text } from '@mantine/core';

import { levelColor } from './levelColor';

import type { BarProps, SectionProps, StatProps } from '../../types';
import type { ReactElement } from 'react';

export function Bar({ pct, level, color }: BarProps): ReactElement {
  return (
    <Progress value={Math.max(0, Math.min(100, pct))} color={color ?? levelColor(level)} />
  );
}

export function Section({ title, summary, action, children }: SectionProps): ReactElement {
  return (
    <Box mx={12} mt={20}>
      {action === undefined
        ? <Box className="kicker" style={{ paddingTop: 0 }}>{title}</Box>
        : (
          <Group className="kicker" justify="space-between" wrap="nowrap" gap={8} style={{ paddingTop: 0, paddingBottom: 0 }}>
            <Box component="span">{title}</Box>
            {action}
          </Group>
        )}
      {summary !== undefined && summary !== null && summary !== '' && <Text fz={15} fw={600} pt={10} style={{ textWrap: 'pretty' }}>{summary}</Text>}
      {children}
    </Box>
  );
}

export function Stat({ k, v, s, children }: StatProps): ReactElement {
  return (
    <Box py={10} className="row">
      <Text fz={12} tt="uppercase" c="dimmed" style={{ letterSpacing: '.06em' }}>{k}</Text>
      <Text fz={20} fw={800}>{v}</Text>
      {s !== undefined && s !== null && s !== '' && <Text fz={12} c="dimmed">{s}</Text>}
      {children !== undefined && <Box mt={6}>{children}</Box>}
    </Box>
  );
}
