import { Box, UnstyledButton } from '@mantine/core';

import type { MotionBoxBase, MotionButtonBase } from '../types';
import type { ReactElement } from 'react';

export function BoxBase(props: MotionBoxBase): ReactElement {
  return <Box {...props} />;
}

export function ButtonBase(props: MotionButtonBase): ReactElement {
  return <UnstyledButton {...props} />;
}
