import { Box, Transition } from '@mantine/core';
import { useMounted } from '@mantine/hooks';

import { useUiStore } from '../stores/uiStore';
import { SCREEN_MOTION } from '../theme';

import type { ScreenTransitionProps } from '../types';
import type { ReactElement } from 'react';

export function ScreenTransition({ children }: ScreenTransitionProps): ReactElement {
  const direction = useUiStore((s) => s.navDirection);
  const mounted = useMounted();
  return (
    <Transition mounted={mounted} transition={SCREEN_MOTION[direction]} duration={SCREEN_MOTION.duration} timingFunction={SCREEN_MOTION.easing}>
      {(styles) => <Box className="screen-motion" style={styles}>{children}</Box>}
    </Transition>
  );
}
