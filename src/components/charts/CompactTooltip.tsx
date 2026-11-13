import type { CSSProperties } from 'react';
import { Box } from '@mantine/core';
import { t } from '../../i18n';

interface Entry { name?: string; value?: number | string; color?: string; stroke?: string; fill?: string; unit?: string; dataKey?: string }

const WIDTH = 4;

const one = (v: number) => String(Math.round(v * 10) / 10);

function fit(value: number | string | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return typeof value === 'string' ? value : '–';
  const abs = Math.abs(value);
  const tries = [one(value), String(Math.round(value))];
  if (abs >= 1000) tries.push(`${one(value / 1e3)}k`, `${Math.round(value / 1e3)}k`);
  if (abs >= 1e6) tries.push(`${one(value / 1e6)}M`, `${Math.round(value / 1e6)}M`);
  return tries.find((s) => s.length <= WIDTH) ?? tries[tries.length - 1];
}

const PER_ROW = 3;

export function CompactTooltip({ active, label, payload }: { active?: boolean; label?: string | number; payload?: readonly object[] }) {
  const rows = (active && payload ? payload : []) as Entry[];
  const title = (rows[0] as { payload?: { when?: string } } | undefined)?.payload?.when ?? label;
  const grid = rows.length > PER_ROW;
  const cell = (e: Entry, i: number) => (
    <Box key={e.dataKey ?? e.name ?? i} component="b" className="tt-row" style={{ '--tt-c': e.color ?? e.stroke ?? e.fill } as CSSProperties}>
      <Box component="span" className="tt-row-name">{e.name}</Box>
      <Box component="span" className="tt-row-val">
        {fit(e.value)}{e.unit ?? ''}
      </Box>
    </Box>
  );
  return (
    <Box className="tt" data-empty={rows.length ? undefined : true}>
      {rows.length ? (
        <>
          <Box className="tt-title">
            <Box component="b" className="tt-name">{title}</Box>
            {!grid && rows.map(cell)}
          </Box>
          {grid && (
            <Box className="tt-grid">
              {rows.map(cell)}
            </Box>
          )}
        </>
      ) : <Box component="span" className="tt-hint">{t('common.touchChart')}</Box>}
    </Box>
  );
}
