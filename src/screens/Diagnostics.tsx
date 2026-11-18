import { Box, Button, CopyButton, Group, Stack, Text, Title } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';

import { ScreenHeader } from '../components/ScreenHeader';
import { useStorageEstimate } from '../components/useStorageEstimate';
import { t } from '../i18n';
import { useDiagnosticsStore } from '../stores';
import { diagnosticsReport } from '../utils/diagnostics';

import type { ReactElement } from 'react';

const ms = (v: number) => String(Math.round(v));
const mb = (bytes: number) => Math.round((bytes / 1e6) * 10) / 10;

export function Diagnostics(): ReactElement {
  const { entries, clear, metrics } = useDiagnosticsStore(useShallow((s) => ({ entries: s.entries, clear: s.clear, metrics: s.metrics })));
  const storage = useStorageEstimate();
  const frames = entries.filter((e) => e.kind === 'frame');
  let worst = 0;

  for (const e of frames) { worst = Math.max(worst, e.duration); }
  const report = diagnosticsReport(entries, navigator.userAgent, metrics, storage);
  let storageText: string;
  if (storage === null) {
    storageText = t('diagnostics.storageUnknown');
  } else if (storage.low) {
    storageText = t('diagnostics.storageLow', { used: mb(storage.usage) });
  } else {
    storageText = t('diagnostics.storageOk', { used: mb(storage.usage), quota: mb(storage.quota) });
  }
  return (
    <Box className="screen">
      <ScreenHeader />
      <Title className="display display-sm">{t('diagnostics.title')}</Title>
      <Stack gap={0} px={20} pb={24}>
        <Text fz={13} c="dimmed" py={12}>{t('diagnostics.note')}</Text>
        <Text fz={14} fw={700} pb={8}>{t('diagnostics.summary', { count: frames.length, ms: ms(worst) })}</Text>
        <Text fz={13} c="dimmed" py={4}>{t('diagnostics.metrics', { loads: metrics.loads, cacheHits: metrics.cacheHits, recordFlushes: metrics.recordFlushes, recordFlushFailures: metrics.recordFlushFailures, kvFlushes: metrics.kvFlushes, kvFlushFailures: metrics.kvFlushFailures, hydrationFailures: metrics.hydrationFailures })}</Text>
        <Text fz={13} c="dimmed" py={4} pb={12}>{storageText}</Text>
        <Group grow wrap="nowrap" gap={8} pb={12}>
          <CopyButton value={report}>
            {({ copied, copy }) => <Button onClick={copy}>{copied ? t('diagnostics.copied') : t('diagnostics.copy')}</Button>}
          </CopyButton>
          <Button variant="outline" color="gray" onClick={clear}>{t('diagnostics.clear')}</Button>
        </Group>
        {entries.length === 0 && <Text fz={13} c="dimmed">{t('diagnostics.empty')}</Text>}
        {entries.toReversed().map((e) => (
          <Group key={`${e.kind}:${ms(e.at)}:${e.name}`} className="row" justify="space-between" wrap="nowrap" py={8} gap={12}>
            <Box miw={0}>
              <Text fz={13} fw={700} truncate>{e.name}</Text>
              <Text fz={12} c="dimmed" truncate>{e.route} · {ms(e.at)} ms</Text>
            </Box>
            {e.kind === 'failure'
              ? <Text fz={14} fw={800} c="signal.3" truncate style={{ flex: 'none', maxWidth: '55%' }}>{e.detail}</Text>
              : <Text fz={14} fw={800} c={e.duration >= 50 ? 'signal.3' : undefined} style={{ flex: 'none' }}>{ms(e.duration)} ms</Text>}
          </Group>
        ))}
      </Stack>
    </Box>
  );
}
