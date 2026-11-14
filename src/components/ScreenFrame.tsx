import { PresenceContext } from 'motion/react';
import { Suspense, use, useState } from 'react';

import { MOTION, SCREEN_MOTION } from '../theme';

import { MotionBox } from './motionComponents';
import { ScreenBoundary } from './ScreenBoundary';
import { ScreenSettledContext } from './screenSettled';
import { ScreenSk } from './Skeletons';

import type { ScreenDirection, ScreenFrameProps } from '../types';
import type { ReactElement } from 'react';

const VARIANTS = {
  enter: (d: ScreenDirection) => SCREEN_MOTION.enter[d],
  center: SCREEN_MOTION.center,
  exit: (d: ScreenDirection) => SCREEN_MOTION.exit[d],
};

export function ScreenFrame({ direction, ref, children }: ScreenFrameProps): ReactElement {
  const animatesIn = use(PresenceContext)?.initial !== false;
  const [settled, setSettled] = useState(!animatesIn);
  return (
    <MotionBox ref={ref} className="screen-motion" custom={direction} variants={VARIANTS}
      initial="enter" animate="center" exit="exit" transition={MOTION.screen}
      onAnimationComplete={(definition) => { if (definition === 'center') { setSettled(true); } }}>
      <ScreenSettledContext value={settled}>
        <ScreenBoundary>
          <Suspense fallback={<ScreenSk />}>{children}</Suspense>
        </ScreenBoundary>
      </ScreenSettledContext>
    </MotionBox>
  );
}
