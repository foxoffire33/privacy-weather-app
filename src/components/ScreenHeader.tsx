import { ActionIcon, Group } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router';

import { t } from '../i18n';
import { BACK_STATE, paths } from '../utils/paths';

import { Icon } from './Icon';

import type { ScreenHeaderProps } from '../types';
import type { ReactElement } from 'react';

export function ScreenHeader({ right }: ScreenHeaderProps): ReactElement {
  const navigate = useNavigate();
  const first = useLocation().key === 'default';
  const back = () => { if (first) { void navigate(paths.home, { state: BACK_STATE }); } else { void navigate(-1); } };
  return (
    <Group justify="space-between" p={8}>
      <ActionIcon onClick={back} aria-label={t('common.back')}><Icon name="back" /></ActionIcon>
      {right}
    </Group>
  );
}
