import { Text } from '@mantine/core';

import { t } from '../i18n';
import { useBootStore } from '../stores';

import type { ReactElement } from 'react';

export function StorageWarning(): ReactElement | null {
  const error = useBootStore((s) => s.storageError);
  if (error === null) { return null; }
  return <Text fz={12} fw={600} c="signal.3" px={16} py={8} role="alert">{t('common.storageFault', { error })}</Text>;
}
