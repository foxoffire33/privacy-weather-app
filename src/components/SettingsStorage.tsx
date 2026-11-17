import { Box, Button, Group, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

import { t } from '../i18n';
import { clearResponseCache, estimateStorage } from '../stores/core/persistence';

import type { StorageEstimate } from '../stores/core/persistence';
import type { ReactElement } from 'react';

export function SettingsStorage(): ReactElement {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  useEffect(() => { void estimateStorage().then(setEstimate); }, []);
  const onClearCache = async (): Promise<void> => {
    await clearResponseCache();
    setEstimate(await estimateStorage());
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
    </Box>
  );
}
