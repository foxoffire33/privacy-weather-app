import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ActionIcon, Box, Group, UnstyledButton } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { refreshAll, refreshCity, useAnyForecastLoading, useCities } from '../storesV2';
import { useUiStore } from '../store/uiStore';
import { Icon } from '../components/Icon';
import { CityPage } from './CityPage';
import { t } from '../i18n';

const HINT_KEY = 'weather-log-hint-seen';
const hintSeen = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };

function GestureHint({ multiple }: { multiple: boolean }) {
  const [open, setOpen] = useState(() => !hintSeen());
  const close = () => { setOpen(false); try { localStorage.setItem(HINT_KEY, '1'); } catch {} };
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(close, 12000);
    return () => window.clearTimeout(t);
  }, [open]);
  if (!open) return null;
  return (
    <UnstyledButton className="gesture-hint" onClick={close}>
      {multiple ? t('home.hintSwipe') : ''}{t('home.hint')}
    </UnstyledButton>
  );
}

export function Home() {
  const cities = useCities();
  const updating = useAnyForecastLoading();
  const { pageIndex, setPage, navigate } = useUiStore(useShallow((s) => ({
    pageIndex: s.pageIndex, setPage: s.setPage, navigate: s.navigate,
  })));
  const n = cities.length;
  const idx = Math.min(pageIndex, n - 1);
  const pagerRef = useRef<HTMLDivElement>(null);
  const dx = useRef(0);
  const drag = useRef<{ x: number; y: number; id: number; active: boolean } | null>(null);
  const justDragged = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && idx < n - 1) setPage(idx + 1);
      if (e.key === 'ArrowLeft' && idx > 0) setPage(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, n, setPage]);
  const activeId = cities[idx]?.id;
  useEffect(() => {
    if (!activeId) return;
    const t = window.setTimeout(() => void refreshCity(activeId), 450);
    return () => window.clearTimeout(t);
  }, [activeId]);
  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-noswipe]')) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        d.active = true;
        e.currentTarget.setPointerCapture(d.id);
        e.currentTarget.style.transition = 'none';
      } else if (Math.abs(my) > 8) {
        drag.current = null;
        return;
      } else return;
    }
    const atEdge = (idx === 0 && mx > 0) || (idx === n - 1 && mx < 0);
    dx.current = atEdge ? mx / 3 : mx;
    e.currentTarget.style.transform = `translateX(calc(${-idx * 100}% + ${dx.current}px))`;
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    justDragged.current = true;
    const moved = dx.current;
    dx.current = 0;
    const next = moved < -60 && idx < n - 1 ? idx + 1 : moved > 60 && idx > 0 ? idx - 1 : idx;
    const el = pagerRef.current;
    if (el) { el.style.transition = ''; el.style.transform = `translateX(${-next * 100}%)`; }
    if (next !== idx) setPage(next);
  };
  return (
    <Box style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <Box className="pager" ref={pagerRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClickCapture={(e) => { if (justDragged.current) { e.stopPropagation(); justDragged.current = false; } }}
        style={{ transform: `translateX(${-idx * 100}%)` }}>
        {cities.map((c, i) => (Math.abs(i - idx) <= 1
          ? <CityPage key={c.id} city={c} isDefault={i === 0} />
          : <Box key={c.id} className="page" />))}
      </Box>
      <GestureHint multiple={n > 1} />
      <Box className="overlay">
        <ActionIcon variant="transparent" c="white" aria-label={t('home.cities')} onClick={() => navigate({ name: 'cities' })}>
          <Icon name="list" />
        </ActionIcon>
        <Group gap={6} wrap="nowrap">
          {cities.map((c, i) => (
            <UnstyledButton key={c.id} className="dot" data-active={i === idx || undefined}
              aria-label={t('home.show', { name: c.name })} onClick={() => setPage(i)} />
          ))}
        </Group>
        <Group gap={0} wrap="nowrap">
          <ActionIcon variant="transparent" c="white" aria-label={updating ? t('common.updating') : t('home.refreshAll')} aria-busy={updating || undefined}
            onClick={() => refreshAll({ maxAgeMs: 0 })}>
            <Box component="span" className={updating ? 'spin' : undefined}><Icon name="refresh" size={20} /></Box>
          </ActionIcon>
          <ActionIcon variant="transparent" c="white" aria-label={t('home.settings')} onClick={() => navigate({ name: 'settings' })}>
            <Icon name="sliders" />
          </ActionIcon>
        </Group>
      </Box>
    </Box>
  );
}
