import { Box, Transition } from '@mantine/core';
import { useMounted } from '@mantine/hooks';
import { NavigationType, useLocation, useNavigationType } from 'react-router';

import { isRecord } from '../stores/core/guards';
import { SCREEN_MOTION } from '../theme';

import type { ScreenTransitionProps } from '../types';
import type { ReactElement } from 'react';

export function ScreenTransition({ children }: ScreenTransitionProps): ReactElement {
  const state: unknown = useLocation().state;
  const back = useNavigationType() === NavigationType.Pop || (isRecord(state) && state.back === true);
  const direction = back ? 'back' : 'forward';
  const mounted = useMounted();
  return (
    <Transition mounted={mounted} transition={SCREEN_MOTION[direction]} duration={SCREEN_MOTION.duration} timingFunction={SCREEN_MOTION.easing}>
      {(styles) => <Box className="screen-motion" style={styles}>{children}</Box>}
    </Transition>
  );
}
