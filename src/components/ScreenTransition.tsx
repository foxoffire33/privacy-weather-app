import { AnimatePresence } from 'motion/react';
import { Suspense } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';

import { isRecord } from '../stores/core/guards';
import { MOTION, SCREEN_MOTION } from '../theme';

import { MotionBox } from './motionComponents';
import { ScreenBoundary } from './ScreenBoundary';
import { ScreenSk } from './Skeletons';

import type { ScreenDirection, ScreenTransitionProps } from '../types';
import type { ReactElement } from 'react';

function directionFor(popped: boolean, state: Record<string, unknown>): ScreenDirection {
  if (state.swipe === 'next') { return 'swipeNext'; }
  if (state.swipe === 'prev') { return 'swipePrev'; }
  return popped || state.back === true ? 'back' : 'forward';
}

const VARIANTS = {
  enter: (d: ScreenDirection) => SCREEN_MOTION.enter[d],
  center: SCREEN_MOTION.center,
  exit: (d: ScreenDirection) => SCREEN_MOTION.exit[d],
};

export function ScreenTransition({ children }: ScreenTransitionProps): ReactElement {
  const location = useLocation();
  const state: unknown = location.state;
  const direction = directionFor(useNavigationType() === NavigationType.Pop, isRecord(state) ? state : {});
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <MotionBox key={location.pathname} className="screen-motion" custom={direction} variants={VARIANTS}
        initial="enter" animate="center" exit="exit" transition={MOTION.screen}>
        <ScreenBoundary>
          <Suspense fallback={<ScreenSk />}>{children}</Suspense>
        </ScreenBoundary>
      </MotionBox>
    </AnimatePresence>
  );
}
