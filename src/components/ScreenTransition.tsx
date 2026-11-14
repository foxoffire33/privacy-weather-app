import { Box, Transition } from '@mantine/core';
import { useMounted } from '@mantine/hooks';
import { NavigationType, useLocation, useNavigationType } from 'react-router';

import { isRecord } from '../stores/core/guards';
import { SCREEN_MOTION } from '../theme';

import type { ScreenMotion, ScreenTransitionProps } from '../types';
import type { ReactElement } from 'react';

function motionFor(popped: boolean, state: Record<string, unknown>): keyof Omit<ScreenMotion, 'duration' | 'easing'> {
  if (state.swipe === 'next') { return 'swipeNext'; }
  if (state.swipe === 'prev') { return 'swipePrev'; }
  return popped || state.back === true ? 'back' : 'forward';
}

export function ScreenTransition({ children }: ScreenTransitionProps): ReactElement {
  const state: unknown = useLocation().state;
  const popped = useNavigationType() === NavigationType.Pop;
  const direction = motionFor(popped, isRecord(state) ? state : {});
  const mounted = useMounted();
  return (
    <Transition mounted={mounted} transition={SCREEN_MOTION[direction]} duration={SCREEN_MOTION.duration} timingFunction={SCREEN_MOTION.easing}>
      {(styles) => <Box className="screen-motion" style={styles}>{children}</Box>}
    </Transition>
  );
}
