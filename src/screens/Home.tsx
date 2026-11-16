import { ActionIcon, Box, Group, UnstyledButton } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useDragControls } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';

import { SectionOrder } from '../components/city/SectionOrder';
import { Icon } from '../components/Icon';
import { MotionBox, MotionButton } from '../components/motionComponents';
import { t } from '../i18n';
import { refreshCity, useCities } from '../stores';
import { useUiStore } from '../stores/uiStore';
import { MOTION } from '../theme';
import { GESTURE } from '../utils/gesture';
import { paths } from '../utils/paths';

import { CityPage } from './CityPage';

import type { GestureHintProps } from '../types';
import type { PanInfo } from 'motion/react';
import type { PointerEvent, ReactElement } from 'react';

const PAGE_SWIPE = 60;
const PAGE_VELOCITY = 0.2;
const EDGE_ELASTIC = 0.33;
const DOT = 8;
const DOT_ACTIVE = 22;
const DOT_ON = 'rgba(255, 255, 255, 1)';
const DOT_OFF = 'rgba(255, 255, 255, 0.45)';

function GestureHint({ multiple }: GestureHintProps) {
  const seen = useUiStore((s) => s.gestureHintSeen);
  const close = useUiStore((s) => s.dismissGestureHint);
  useEffect(() => {
    if (seen) { return; }
    const timer = globalThis.setTimeout(close, 12_000);
    return () => { globalThis.clearTimeout(timer); };
  }, [seen, close]);
  if (seen) { return null; }
  return (
    <UnstyledButton className="gesture-hint" onClick={close}>
      {multiple ? t('home.hintSwipe') : ''}{t('home.hint')}
    </UnstyledButton>
  );
}

function settlePage(moved: number, idx: number, n: number): number {
  if (moved < -PAGE_SWIPE && idx < n - 1) { return idx + 1; }
  if (moved > PAGE_SWIPE && idx > 0) { return idx - 1; }
  return idx;
}

export function Home(): ReactElement {
  const cities = useCities();
  const openOrder = useUiStore((s) => s.setSectionOrderOpen);
  const navigate = useNavigate();
  const { pageIndex, setPage } = useUiStore(useShallow((s) => ({
    pageIndex: s.pageIndex, setPage: s.setPage,
  })));
  const n = cities.length;
  const idx = Math.min(pageIndex, n - 1);
  const [mountIdx, setMountIdx] = useState(idx);
  const controls = useDragControls();
  const justDragged = useRef(false);
  const axis = useRef<'x' | 'y' | null>(null);
  useHotkeys([
    ['ArrowRight', () => { if (idx < n - 1) { setPage(idx + 1); } }],
    ['ArrowLeft', () => { if (idx > 0) { setPage(idx - 1); } }],
  ]);
  const activeId = cities.at(idx)?.id;
  useEffect(() => {
    if (activeId === undefined) { return; }
    const timer = globalThis.setTimeout(() => void refreshCity(activeId), 450);
    return () => { globalThis.clearTimeout(timer); };
  }, [activeId]);
  const onDown = (e: PointerEvent) => {
    justDragged.current = false;
    if (e.target instanceof Element && e.target.closest('[data-noswipe]') !== null) { return; }
    controls.start(e);
  };
  const onDragEnd = (event: globalThis.PointerEvent, info: PanInfo) => {
    GESTURE.end();
    const locked = axis.current;
    axis.current = null;
    if (event.type === 'pointercancel' || locked !== 'x') { return; }
    const next = settlePage(info.offset.x + info.velocity.x * PAGE_VELOCITY, idx, n);
    if (next !== idx) { setPage(next); }
  };
  return (
    <Box style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <MotionBox className="pager" animate={{ transform: `translateX(${String(-idx * 100)}%)` }} transition={MOTION.settle} initial={false}
        onAnimationComplete={() => { setMountIdx(idx); }}>
        <MotionBox className="pager-track" drag="x" dragListener={false} dragControls={controls} dragDirectionLock dragSnapToOrigin
          dragMomentum={false} dragConstraints={{ left: 0, right: 0 }} dragTransition={MOTION.settle}
          dragElastic={{ left: idx < n - 1 ? 1 : EDGE_ELASTIC, right: idx > 0 ? 1 : EDGE_ELASTIC }}
          onPointerDown={onDown} onDirectionLock={(a) => { axis.current = a; }} onDragStart={() => { justDragged.current = true; GESTURE.start(); }} onDragEnd={onDragEnd}
          onClickCapture={(e) => { if (justDragged.current) { e.stopPropagation(); justDragged.current = false; } }}>
          {cities.map((c, i) => (i === idx || Math.abs(i - mountIdx) <= 1
            ? <CityPage key={c.id} city={c} isDefault={i === 0} />
            : <Box key={c.id} className="page" />))}
        </MotionBox>
      </MotionBox>
      <GestureHint multiple={n > 1} />
      <SectionOrder />
      <Box className="overlay">
        <ActionIcon variant="transparent" c="white" aria-label={t('home.cities')} onClick={() => { void navigate(paths.cities); }}>
          <Icon name="list" />
        </ActionIcon>
        <Group gap={6} wrap="nowrap">
          {cities.map((c, i) => (
            <MotionButton key={c.id} className="dot" data-active={i === idx || undefined} initial={false} transition={MOTION.quick}
              animate={{ width: i === idx ? DOT_ACTIVE : DOT, backgroundColor: i === idx ? DOT_ON : DOT_OFF }}
              aria-label={t('home.show', { name: c.name })} onClick={() => { setPage(i); }} />
          ))}
        </Group>
        <Group gap={0} wrap="nowrap">
          <ActionIcon variant="transparent" c="white" aria-label={t('city.order.title')} onClick={() => { openOrder(true); }}>
            <Icon name="reorder" size={20} />
          </ActionIcon>
          <ActionIcon variant="transparent" c="white" aria-label={t('home.settings')} onClick={() => { void navigate(paths.settings); }}>
            <Icon name="sliders" />
          </ActionIcon>
        </Group>
      </Box>
    </Box>
  );
}
