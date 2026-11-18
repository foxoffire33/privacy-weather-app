import { Box, Button, Group, Text } from '@mantine/core';

import { t } from '../i18n';
import { flushRecords, retryPersistedState, useBootStore } from '../stores';
import { noteStorageFault } from '../stores/bootStore';
import { clearResponseCache } from '../stores/core/persistence';
import { persistenceStatus } from '../stores/core/persistStorage';
import { recordSyncStatus, retryPendingRecordClears } from '../stores/core/recordSync';
import { useDiagnosticsStore } from '../stores/diagnosticsStore';

import type { ReactElement } from 'react';

function retrySaves(): void {
  void retryPersistedState().catch(() => null);
  void retryPendingRecordClears().then(async () => { await flushRecords(); }).catch(() => null);
}

function clearCached(): void {
  void clearResponseCache().catch(noteStorageFault);
}

export function StorageWarning(): ReactElement | null {
  const error = useBootStore((s) => s.storageError);
  const quotaExceeded = useBootStore((s) => s.storageQuotaExceeded);
  useDiagnosticsStore((s) => s.metrics);
  if (error === null) { return null; }
  const pending = persistenceStatus().pending || recordSyncStatus().pending > 0;
  return (
    <Box px={16} pt={8} pb={6}>
      <Text fz={12} fw={600} c="signal.3" role="alert">{t('common.storageFault')} {t(error.messageKey)}</Text>
      <Text fz={12} c="dimmed">{t(pending ? 'common.storagePending' : 'common.storageRecovered')}</Text>
      <Group gap={8} mt={6}>
        <Button size="xs" variant="light" color="gray" onClick={retrySaves}>{t('common.retrySave')}</Button>
        {quotaExceeded && (
          <Button size="xs" variant="light" color="gray" onClick={clearCached}>{t('settings.storageClearCache')}</Button>
        )}
      </Group>
    </Box>
  );
}
