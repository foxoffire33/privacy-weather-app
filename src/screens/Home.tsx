import { ActionIcon, Box, Group, UnstyledButton } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';

import { Icon } from '../components/Icon';
import { t } from '../i18n';
import { refreshAll, refreshCity, useAnyForecastLoading, useCities } from '../stores';
import { useUiStore } from '../stores/uiStore';
import { paths } from '../utils/paths';

import { CityPage } from './CityPage';

import type { GestureHintProps, PagerGesture } from '../types';
import type { PointerEvent, ReactElement } from 'react';

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
  if (moved < -60 && idx < n - 1) { return idx + 1; }
  if (moved > 60 && idx > 0) { return idx - 1; }
  return idx;
}

export function Home(): ReactElement {
  const cities = useCities();
  const updating = useAnyForecastLoading();
  const navigate = useNavigate();
  const { pageIndex, setPage } = useUiStore(useShallow((s) => ({
    pageIndex: s.pageIndex, setPage: s.setPage,
  })));
  const n = cities.length;
  const idx = Math.min(pageIndex, n - 1);
  const pagerRef = useRef<HTMLDivElement>(null);
  const dx = useRef(0);
  const drag = useRef<PagerGesture | null>(null);
  const justDragged = useRef(false);
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
    if (e.target instanceof Element && e.target.closest('[data-noswipe]') !== null) { return; }
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) { return; }
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        d.active = true;
        e.currentTarget.setPointerCapture(d.id);
        if (pagerRef.current) { pagerRef.current.style.transition = 'none'; }
      } else if (Math.abs(my) > 8) {
        drag.current = null;
        return;
      } else { return; }
    }
    const atEdge = (idx === 0 && mx > 0) || (idx === n - 1 && mx < 0);
    dx.current = atEdge ? mx / 3 : mx;
    if (pagerRef.current) { pagerRef.current.style.transform = `translateX(calc(${String(-idx * 100)}% + ${String(dx.current)}px))`; }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.active !== true) { return; }
    justDragged.current = true;
    const moved = dx.current;
    dx.current = 0;
    const next = settlePage(moved, idx, n);
    const el = pagerRef.current;
    if (el) { el.style.transition = ''; el.style.transform = `translateX(${String(-next * 100)}%)`; }
    if (next !== idx) { setPage(next); }
  };
  return (
    <Box style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <Box className="pager" ref={pagerRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClickCapture={(e) => { if (justDragged.current) { e.stopPropagation(); justDragged.current = false; } }}
        style={{ transform: `translateX(${String(-idx * 100)}%)` }}>
        {cities.map((c, i) => (Math.abs(i - idx) <= 1
          ? <CityPage key={c.id} city={c} isDefault={i === 0} />
          : <Box key={c.id} className="page" />))}
      </Box>
      <GestureHint multiple={n > 1} />
      <Box className="overlay">
        <ActionIcon variant="transparent" c="white" aria-label={t('home.cities')} onClick={() => { void navigate(paths.cities); }}>
          <Icon name="list" />
        </ActionIcon>
        <Group gap={6} wrap="nowrap">
          {cities.map((c, i) => (
            <UnstyledButton key={c.id} className="dot" data-active={i === idx || undefined}
              aria-label={t('home.show', { name: c.name })} onClick={() => { setPage(i); }} />
          ))}
        </Group>
        <Group gap={0} wrap="nowrap">
          <ActionIcon variant="transparent" c="white" aria-label={updating ? t('common.updating') : t('home.refreshAll')} aria-busy={updating || undefined}
            onClick={() => { void refreshAll({ maxAgeMs: 0 }); }}>
            <Box component="span" className={updating ? 'spin' : undefined}><Icon name="refresh" size={20} /></Box>
          </ActionIcon>
          <ActionIcon variant="transparent" c="white" aria-label={t('home.settings')} onClick={() => { void navigate(paths.settings); }}>
            <Icon name="sliders" />
          </ActionIcon>
        </Group>
      </Box>
    </Box>
  );
}
