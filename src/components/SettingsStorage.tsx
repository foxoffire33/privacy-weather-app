import { Box, Button, Group, Text } from '@mantine/core';
import { useState } from 'react';

import { t } from '../i18n';
import { noteStorageFault } from '../stores/bootStore';
import { clearResponseCache } from '../stores/core/persistence';

import { useStorageEstimate } from './useStorageEstimate';

import type { ReactElement } from 'react';

export function SettingsStorage(): ReactElement {
  const estimate = useStorageEstimate();
  const [clearFailed, setClearFailed] = useState(false);
  const onClearCache = async (): Promise<void> => {
    try {
      await clearResponseCache();
      setClearFailed(false);
    } catch (error) {
      setClearFailed(true);
      noteStorageFault(error);
    }
  };
  return (
    <Box py={12} className="row">
      <Text fz={14} fw={600}>{t('settings.storage')}</Text>
      <Text fz={12} c="dimmed">{t('settings.storageNote')}</Text>
      {estimate !== null && estimate.low && (
        <Group gap={8}>
          <Text fz={12} c="signal.3">{t('settings.storageLow')}</Text>
          <Button size="xs" variant="light" color="gray" onClick={() => void onClearCache()}>{t('settings.storageClearCache')}</Button>
        </Group>
      )}
      {clearFailed && <Text fz={12} c="signal.3" role="alert">{t('errors.storageWrite')}</Text>}
    </Box>
  );
}
