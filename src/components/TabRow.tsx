import { Box } from '@mantine/core';
import { LayoutGroup } from 'motion/react';
import { useId } from 'react';

import { MOTION } from '../theme';

import { MotionBox, MotionButton } from './motionComponents';

import type { TabRowProps } from '../types';
import type { ReactElement } from 'react';

export function TabRow<T extends string | number>({ className, items, active, onChange }: TabRowProps<T>): ReactElement {
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <Box className={className} role="tablist">
        {items.map(({ value, label }) => {
          const on = value === active;
          return (
            <MotionButton key={String(value)} type="button" role="tab" aria-selected={on} data-active={on || undefined}
              whileTap={{ scale: 0.96 }} transition={MOTION.quick} onClick={() => { onChange(value); }}>
              {on && <MotionBox layoutId="tab-highlight" className="tab-highlight" transition={MOTION.settle} />}
              <Box component="span" className="tab-label">{label}</Box>
            </MotionButton>
          );
        })}
      </Box>
    </LayoutGroup>
  );
}
