import { Group, SimpleGrid, Stack, Text } from '@mantine/core';

import { t } from '../../i18n';
import { isRecord } from '../../stores/core/guards';

import type { CompactTooltipProps, TooltipEntry } from '../../types';
import type { ReactElement } from 'react';

const WIDTH = 4;

const one = (v: number) => String(Math.round(v * 10) / 10);

function fit(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) { return typeof value === 'string' ? value : '–'; }
  const abs = Math.abs(value);
  const tries = [one(value), String(Math.round(value))];
  if (abs >= 1000) {tries.push(`${one(value / 1e3)}k`, `${String(Math.round(value / 1e3))}k`);}
  if (abs >= 1e6) {tries.push(`${one(value / 1e6)}M`, `${String(Math.round(value / 1e6))}M`);}
  return tries.find((s) => s.length <= WIDTH) ?? tries.at(-1) ?? '–';
}

const PER_ROW = 3;

export function CompactTooltip({ active, label, payload }: CompactTooltipProps): ReactElement {
  const rows: readonly TooltipEntry[] = active ? payload : [];
  const point: unknown = rows.at(0)?.payload;
  const title = isRecord(point) && typeof point.when === 'string' ? point.when : label;
  const grid = rows.length > PER_ROW;
  const cell = (e: TooltipEntry) => (
    <Group key={e.graphicalItemId} component="b" gap={4} align="baseline" wrap="nowrap"
      style={{ color: e.color ?? e.stroke ?? e.fill, flex: '1 1 auto', minWidth: 0 }}>
      <Text span inherit fw={400} opacity={0.8} truncate="end" miw={0}>{e.name}</Text>
      <Text span inherit ml="auto" miw={`${String(WIDTH)}ch`} ta="right" style={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
        {fit(e.value)}{e.unit ?? ''}
      </Text>
    </Group>
  );
  return (
    <Stack gap={2} justify="center" w="100%" mih={24} px={8} py={3} fz={12} lh="16px" style={{
      border: `1px solid ${rows.length > 0 ? 'var(--rule)' : 'rgba(255,255,255,.12)'}`, background: rows.length > 0 ? '#000' : 'transparent',
      boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      {rows.length > 0 ? (
        <>
          <Group gap={12} align="baseline" wrap="nowrap">
            <Text span inherit fw={700} fz={13} mr="auto">{title}</Text>
            {!grid && rows.map((e) => cell(e))}
          </Group>
          {grid && (
            <SimpleGrid cols={PER_ROW} spacing={12} verticalSpacing={2}>
              {rows.map((e) => cell(e))}
            </SimpleGrid>
          )}
        </>
      ) : <Text span inherit c="rgba(255,255,255,.3)">{t('common.touchChart')}</Text>}
    </Stack>
  );
}
