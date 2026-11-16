import { Box, Text, useMantineTheme } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { useGesture } from '@use-gesture/react';
import { animate, useMotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { t } from '../../i18n';
import { MOTION } from '../../theme';
import { MotionBox } from '../motionComponents';

import type { PinchStart, RadarMapProps } from '../../types';
import type { ReactElement } from 'react';

const DOT = 0.2;
const RAIN = 0.62;
const MIN_DOT = 1.5;
const PINCH_MIN = 0.25;
const PINCH_MAX = 4;
const HINT_MS = 1400;

function isPinchStart(value: unknown): value is PinchStart {
  return typeof value === 'object' && value !== null && 'ox' in value && 'oy' in value;
}

export function RadarMap({ land, cells, hidden, height, visibleCols, visibleRows, baseScale, zoom, onPinchZoom }: RadarMapProps): ReactElement {
  const theme = useMantineTheme();
  const { ref, width, height: boxHeight } = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(baseScale);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
  const lastZoom = useRef(zoom);
  useEffect(() => {
    const factor = lastZoom.current / zoom;
    lastZoom.current = zoom;
    if (factor === 1) { return; }
    const clamp = (value: number, slack: number) => Math.max(-slack, Math.min(slack, value));
    void animate(x, clamp(x.get() * factor, slackX), MOTION.settle);
    void animate(y, clamp(y.get() * factor, slackY), MOTION.settle);
  }, [zoom, x, y, slackX, slackY]);
  const clampX = (value: number, size: number) => Math.max(-Math.max(0, (cssW * size - viewW) / 2), Math.min(Math.max(0, (cssW * size - viewW) / 2), value));
  const clampY = (value: number, size: number) => Math.max(-Math.max(0, (cssH * size - viewH) / 2), Math.min(Math.max(0, (cssH * size - viewH) / 2), value));
  const showHint = () => {
    setHint(true);
    globalThis.clearTimeout(hintTimer.current);
    hintTimer.current = globalThis.setTimeout(() => { setHint(false); }, HINT_MS);
  };
  useGesture({
    onPinch: ({ da, initial, origin: [ox, oy], first, last, memo }) => {
      const saved: unknown = memo;
      const start: PinchStart = !first && isPinchStart(saved) ? saved : { ox, oy, x: x.get(), y: y.get() };
      const ratio = Math.min(PINCH_MAX, Math.max(PINCH_MIN, da[0] / Math.max(1, initial[0])));
      x.set(clampX(start.x + ox - start.ox, baseScale * ratio));
      y.set(clampY(start.y + oy - start.oy, baseScale * ratio));
      if (!last) {
        scale.set(baseScale * ratio);
        return start;
      }
      if (!onPinchZoom(ratio)) { void animate(scale, baseScale, MOTION.settle); }
      return start;
    },
    onDrag: ({ event, offset: [dx, dy], touches, first, last }) => {
      if (event instanceof PointerEvent && event.pointerType === 'touch') {
        if (touches < 2 && !last) { showHint(); }
        return;
      }
      if (first) { return; }
      x.set(clampX(dx, scale.get()));
      y.set(clampY(dy, scale.get()));
    },
  }, {
    target: area,
    eventOptions: { passive: false },
    pinch: { pinchOnWheel: false },
    drag: { from: () => [x.get(), y.get()], filterTaps: true },
  });
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
      const level = Number(cells?.[i] ?? '0');
      if (level > 0 && !hidden.includes(String(level))) {
        ctx.fillStyle = rain[level - 1] ?? theme.white;
        ctx.fillRect(px + (cell - square) / 2, py + (cell - square) / 2, square, square);
      } else if (land.cells[i] === '1') {
        ctx.fillStyle = theme.white;
        ctx.fillRect(px + (cell - dot) / 2, py + (cell - dot) / 2, dot, dot);
      }
    }
    if (hidden.includes('city')) { return; }
    ctx.fillStyle = theme.white;
    ctx.fillRect(Math.floor(land.cols / 2) * cell + (cell - square) / 2, Math.floor(land.rows / 2) * cell + (cell - square) / 2, square, square);
  }, [land, cells, hidden, cell, cssW, cssH, signal, theme.white]);
  return (
    <Box ref={ref} w="100%" mah={height} role="img" aria-label={t('radar.mapLabel')} data-noswipe
      style={{ aspectRatio: `${String(visibleCols)} / ${String(visibleRows)}` }}>
      <Box ref={area} pos="relative" w={viewW} h={viewH} mx="auto" style={{ overflow: 'hidden', touchAction: 'pan-y' }}>
        <MotionBox pos="absolute" left={(viewW - cssW) / 2} top={(viewH - cssH) / 2} w={cssW} h={cssH} style={{ x, y, scale, cursor: 'grab' }}>
          <Box component="canvas" ref={canvas} aria-hidden display="block" w={cssW} h={cssH} />
        </MotionBox>
        <MotionBox pos="absolute" inset={0} display="flex" bg="rgba(0, 0, 0, .55)" initial={false} animate={{ opacity: hint ? 1 : 0 }}
          transition={MOTION.quick} style={{ alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Text fz={15} fw={800} ta="center" px={24}>{t('radar.twoFingers')}</Text>
        </MotionBox>
      </Box>
    </Box>
  );
}
