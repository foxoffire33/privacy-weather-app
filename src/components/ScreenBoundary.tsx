import { Box, Button, Text } from '@mantine/core';
import { Component } from 'react';

import { t } from '../i18n';

import type { ScreenBoundaryProps, ScreenBoundaryState } from '../types';
import type { ReactNode } from 'react';

export class ScreenBoundary extends Component<ScreenBoundaryProps, ScreenBoundaryState> {
  override state: ScreenBoundaryState = { failed: false };

  static getDerivedStateFromError(): ScreenBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) { return this.props.children; }
    return (
      <Box className="screen" px={20} pt={56} role="alert">
        <Text fz={18} fw={800}>{t('common.screenFailed')}</Text>
        <Button mt={16} fullWidth onClick={() => { globalThis.location.reload(); }}>{t('common.tryAgain')}</Button>
      </Box>
    );
  }
}
