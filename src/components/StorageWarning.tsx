import { Box, Button, Group, Text } from '@mantine/core';

import { t } from '../i18n';
import { flushRecords, retryPersistedState, useBootStore } from '../stores';
import { clearResponseCache } from '../stores/core/persistence';

import type { ReactElement } from 'react';

function retrySaves(): void {
  retryPersistedState();
  void flushRecords();
}

function clearCached(): void {
  void clearResponseCache();
}

export function StorageWarning(): ReactElement | null {
  const error = useBootStore((s) => s.storageError);
  if (error === null) { return null; }
  return (
    <Box px={16} pt={8} pb={6}>
      <Text fz={12} fw={600} c="signal.3" role="alert">{t('common.storageFault')} {t(error.messageKey)}</Text>
      <Group gap={8} mt={6}>
        <Button size="xs" variant="light" color="gray" onClick={retrySaves}>{t('common.retrySave')}</Button>
        {error.code === 'storage.quota-exceeded' && (
          <Button size="xs" variant="light" color="gray" onClick={clearCached}>{t('settings.storageClearCache')}</Button>
        )}
      </Group>
    </Box>
  );
}
