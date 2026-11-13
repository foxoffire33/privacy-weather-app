import type { ReactNode } from 'react';
import { ActionIcon, Group } from '@mantine/core';
import { useUiStore } from '../stores/uiStore';
import { Icon } from './Icon';
import { t } from '../i18n';

export function ScreenHeader({ right }: { right?: ReactNode }) {
  const back = useUiStore((s) => s.back);
  return (
    <Group justify="space-between" p={8}>
      <ActionIcon onClick={back} aria-label={t('common.back')}><Icon name="back" /></ActionIcon>
      {right}
    </Group>
  );
}
