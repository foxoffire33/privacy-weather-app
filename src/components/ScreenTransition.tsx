import { AnimatePresence } from 'motion/react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';

import { isRecord } from '../stores/core/guards';

import { ScreenFrame } from './ScreenFrame';

import type { ScreenDirection, ScreenTransitionProps } from '../types';
import type { ReactElement } from 'react';

function directionFor(popped: boolean, state: Record<string, unknown>): ScreenDirection {
  if (state.swipe === 'next') { return 'swipeNext'; }
  if (state.swipe === 'prev') { return 'swipePrev'; }
  return popped || state.back === true ? 'back' : 'forward';
}

export function ScreenTransition({ children }: ScreenTransitionProps): ReactElement {
  const location = useLocation();
  const state: unknown = location.state;
  const direction = directionFor(useNavigationType() === NavigationType.Pop, isRecord(state) ? state : {});
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <ScreenFrame key={location.pathname} direction={direction}>{children}</ScreenFrame>
    </AnimatePresence>
  );
}
