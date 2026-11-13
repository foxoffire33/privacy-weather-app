import type { CSSProperties, ReactNode } from 'react';
import { Box, Text } from '@mantine/core';

export function levelColor(level: number | null | undefined) {
  if (level == null) return 'var(--mantine-color-dark-3)';
  if (level <= 1) return 'var(--mantine-color-dark-1)';
  if (level <= 2) return 'var(--mantine-color-signal-2)';
  if (level <= 3) return 'var(--mantine-color-signal-4)';
  return 'var(--mantine-color-signal-5)';
}

export function Bar({ pct, level, color }: { pct: number; level?: number | null; color?: string }) {
  return (
    <Box className="bar">
      <Box className="bar-fill" style={{ '--bar-w': `${Math.max(0, Math.min(100, pct))}%`, '--bar-c': color ?? levelColor(level) } as CSSProperties} />
    </Box>
  );
}

export function Section({ title, summary, children }: { title: string; summary?: ReactNode; children?: ReactNode }) {
  return (
    <Box mx={12} mt={20}>
      <Box className="kicker" pt={0}>{title}</Box>
      {summary && <Text fz={15} fw={600} pt={10} className="summary-pretty">{summary}</Text>}
      {children}
    </Box>
  );
}

export function Stat({ k, v, s, children }: { k: string; v: ReactNode; s?: ReactNode; children?: ReactNode }) {
  return (
    <Box py={10} className="row">
      <Text fz={12} tt="uppercase" c="dimmed" className="ls-6">{k}</Text>
      <Text fz={20} fw={800}>{v}</Text>
      {s && <Text fz={12} c="dimmed">{s}</Text>}
      {children && <Box mt={6}>{children}</Box>}
    </Box>
  );
}
