import { ActionIcon, Group } from '@mantine/core';
import { useUiStore } from '../store/uiStore';
import { Icon } from './Icon';
import { t } from '../i18n';
import type { ScreenHeaderProps } from '../types';

export function ScreenHeader({ right }: ScreenHeaderProps) {
  const back = useUiStore((s) => s.back);
  return (
    <Group justify="space-between" p={8}>
      <ActionIcon onClick={back} aria-label={t('common.back')}><Icon name="back" /></ActionIcon>
      {right}
    </Group>
  );
}
