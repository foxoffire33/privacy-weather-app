import { Box, Group } from '@mantine/core';
import { Reorder, useDragControls } from 'motion/react';

import { Icon } from '../Icon';

import type { CityRowProps } from '../../types';
import type { ReactElement } from 'react';

export function CityRow({ value, label, onDrop, children }: CityRowProps): ReactElement {
  const controls = useDragControls();
  return (
    <Reorder.Item as="div" value={value} className="city-row" dragListener={false} dragControls={controls}
      whileDrag={{ zIndex: 2, backgroundColor: '#1c1b1b', boxShadow: '0 8px 24px rgba(0, 0, 0, .6)' }}
      onDragEnd={() => { onDrop(value); }}>
      <Group gap={0} wrap="nowrap" align="stretch">
        <Box className="drag-handle" role="button" aria-label={label} tabIndex={0}
          onPointerDown={(e) => { controls.start(e); }}>
          <Icon name="grip" size={20} />
        </Box>
        {children}
      </Group>
    </Reorder.Item>
  );
}
