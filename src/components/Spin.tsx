import { MOTION } from '../theme';

import { MotionBox } from './motionComponents';

import type { SpinProps } from '../types';
import type { ReactElement } from 'react';

export function Spin({ active, children }: SpinProps): ReactElement {
  return (
    <MotionBox component="span" display="inline-flex" animate={{ rotate: active ? 360 : 0 }}
      transition={active ? MOTION.spin : { duration: 0 }}>
      {children}
    </MotionBox>
  );
}
