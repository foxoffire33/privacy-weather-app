import { ActionIcon, Box, Modal } from '@mantine/core';

import { t } from '../../i18n';
import { useUiStore } from '../../stores/uiStore';
import { Icon } from '../Icon';

import type { ExpandButtonProps, FullscreenChartProps } from '../../types';
import type { ReactElement } from 'react';

export const INLINE_HEIGHT = 180;
export const FULL_HEIGHT = 'var(--chart-full-h)';

export function ExpandButton({ id }: ExpandButtonProps): ReactElement {
  const open = useUiStore((s) => s.openChart);
  return (
    <ActionIcon size={36} aria-label={t('chart.fullscreen')} onClick={() => { open(id); }}>
      <Icon name="expand" size={18} />
    </ActionIcon>
  );
}

export function FullscreenChart({ id, title, render }: FullscreenChartProps): ReactElement {
  const opened = useUiStore((s) => s.fullscreenChart === id);
  const close = useUiStore((s) => s.closeChart);
  return (
    <Modal opened={opened} onClose={close} fullScreen title={title}
      closeButtonProps={{ size: 44, iconSize: 20, 'aria-label': t('common.close') }}>
      {opened && <Box px={12} pt={12}>{render(FULL_HEIGHT)}</Box>}
    </Modal>
  );
}
