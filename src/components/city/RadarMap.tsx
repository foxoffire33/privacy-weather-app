import { Box, useMantineTheme } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { useEffect, useRef } from 'react';

import { t } from '../../i18n';

import type { RadarMapProps } from '../../types';
import type { ReactElement } from 'react';

const DOT = 0.2;
const RAIN = 0.62;
const MIN_DOT = 1.5;

export function RadarMap({ land, frame, height }: RadarMapProps): ReactElement {
  const theme = useMantineTheme();
  const { ref, width, height: boxHeight } = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const cell = Math.min(width / land.cols, boxHeight / land.rows);
  const cssW = cell * land.cols;
  const cssH = cell * land.rows;
  const signal = theme.colors.signal;
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (el === null || ctx === null || ctx === undefined || cell <= 0) { return; }
    const ratio = globalThis.devicePixelRatio;
    el.width = Math.round(cssW * ratio);
    el.height = Math.round(cssH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const rain = [signal[8], signal[5], signal[4]];
    const dot = Math.max(MIN_DOT, cell * DOT);
    const square = cell * RAIN;
    for (let i = 0; i < land.cols * land.rows; i += 1) {
      const x = (i % land.cols) * cell;
      const y = Math.floor(i / land.cols) * cell;
      const level = Number(frame?.cells[i] ?? '0');
      if (level > 0) {
        ctx.fillStyle = rain[level - 1] ?? theme.white;
        ctx.fillRect(x + (cell - square) / 2, y + (cell - square) / 2, square, square);
      } else if (land.cells[i] === '1') {
        ctx.fillStyle = theme.white;
        ctx.fillRect(x + (cell - dot) / 2, y + (cell - dot) / 2, dot, dot);
      }
    }
    ctx.fillStyle = theme.white;
    ctx.fillRect(Math.floor(land.cols / 2) * cell + (cell - square) / 2, Math.floor(land.rows / 2) * cell + (cell - square) / 2, square, square);
  }, [land, frame, cell, cssW, cssH, signal, theme.white]);
  return (
    <Box ref={ref} w="100%" mah={height} role="img" aria-label={t('radar.mapLabel')}
      style={{ aspectRatio: `${String(land.cols)} / ${String(land.rows)}` }}>
      <Box component="canvas" ref={canvas} aria-hidden display="block" mx="auto" w={cssW} h={cssH} />
    </Box>
  );
}
