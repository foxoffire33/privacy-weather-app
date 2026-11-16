import { Box, useMantineTheme } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { usePinch } from '@use-gesture/react';
import { animate, useMotionValue } from 'motion/react';
import { useEffect, useRef } from 'react';

import { t } from '../../i18n';
import { MOTION } from '../../theme';
import { MotionBox } from '../motionComponents';

import type { RadarMapProps } from '../../types';
import type { ReactElement } from 'react';

const DOT = 0.2;
const RAIN = 0.62;
const MIN_DOT = 1.5;
const PINCH_MIN = 0.25;
const PINCH_MAX = 4;

export function RadarMap({ land, frame, height, visibleCols, visibleRows, baseScale, zoom, onPinchZoom }: RadarMapProps): ReactElement {
  const theme = useMantineTheme();
  const { ref, width, height: boxHeight } = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(baseScale);
  const cell = Math.min(width / visibleCols, boxHeight / visibleRows);
  const cssW = cell * land.cols;
  const cssH = cell * land.rows;
  const viewW = cell * visibleCols;
  const viewH = cell * visibleRows;
  const slackX = Math.max(0, (cssW * baseScale - viewW) / 2);
  const slackY = Math.max(0, (cssH * baseScale - viewH) / 2);
  const signal = theme.colors.signal;
  useEffect(() => {
    void animate(scale, baseScale, MOTION.settle);
  }, [baseScale, zoom, scale]);
  useEffect(() => {
    void animate(x, 0, MOTION.settle);
    void animate(y, 0, MOTION.settle);
  }, [land, x, y]);
  usePinch(({ da, initial, last }) => {
    const ratio = Math.min(PINCH_MAX, Math.max(PINCH_MIN, da[0] / Math.max(1, initial[0])));
    if (last) {
      if (!onPinchZoom(ratio)) { void animate(scale, baseScale, MOTION.settle); }
      return;
    }
    scale.set(baseScale * ratio);
  }, { target: area, eventOptions: { passive: false }, pinchOnWheel: false });
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
      const px = (i % land.cols) * cell;
      const py = Math.floor(i / land.cols) * cell;
      const level = Number(frame?.cells[i] ?? '0');
      if (level > 0) {
        ctx.fillStyle = rain[level - 1] ?? theme.white;
        ctx.fillRect(px + (cell - square) / 2, py + (cell - square) / 2, square, square);
      } else if (land.cells[i] === '1') {
        ctx.fillStyle = theme.white;
        ctx.fillRect(px + (cell - dot) / 2, py + (cell - dot) / 2, dot, dot);
      }
    }
    ctx.fillStyle = theme.white;
    ctx.fillRect(Math.floor(land.cols / 2) * cell + (cell - square) / 2, Math.floor(land.rows / 2) * cell + (cell - square) / 2, square, square);
  }, [land, frame, cell, cssW, cssH, signal, theme.white]);
  return (
    <Box ref={ref} w="100%" mah={height} role="img" aria-label={t('radar.mapLabel')} data-noswipe
      style={{ aspectRatio: `${String(visibleCols)} / ${String(visibleRows)}` }}>
      <Box ref={area} pos="relative" w={viewW} h={viewH} mx="auto" style={{ overflow: 'hidden', touchAction: 'none' }}>
        <MotionBox drag dragConstraints={{ left: -slackX, right: slackX, top: -slackY, bottom: slackY }} dragElastic={0.08}
          pos="absolute" left={(viewW - cssW) / 2} top={(viewH - cssH) / 2} w={cssW} h={cssH} style={{ x, y, scale, cursor: 'grab' }}>
          <Box component="canvas" ref={canvas} aria-hidden display="block" w={cssW} h={cssH} />
        </MotionBox>
      </Box>
    </Box>
  );
}
