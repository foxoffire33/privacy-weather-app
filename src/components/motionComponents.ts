import { motion, useReducedMotion } from 'motion/react';

import { MOTION } from '../theme';

import { BoxBase, ButtonBase } from './MotionBase';

import type { Transition } from 'motion/react';

export const MotionBox = motion.create(BoxBase);

export const MotionButton = motion.create(ButtonBase);

export function useMotionPreset(preset: Transition): Transition {
  return useReducedMotion() === true ? MOTION.instant : preset;
}
