import { memo, useEffect, useRef, type PointerEvent } from 'react';
import { ActionIcon, Group } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../store';
import { Icon } from '../components/Icon';
import { CityPage } from './CityPage';

// Opens on the default city (index 0). Swipe / drag sideways or use ← → to move through followed cities.
export function Home() {
  const { cities, pageIndex, setPage, navigate, updating, refreshAll } = useWeatherStore(useShallow((s) => ({
    cities: s.cities,
    pageIndex: s.pageIndex,
    setPage: s.setPage,
    navigate: s.navigate,
    updating: Object.values(s.status).some((x) => x.loading),
    refreshAll: s.refreshAll,
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

  // The visible city refreshes after the slide has settled, never during it.
  const activeId = cities[idx]?.id;
  useEffect(() => {
    if (!activeId) return;
    const t = window.setTimeout(() => void useWeatherStore.getState().refreshCity(activeId), 450);
    return () => window.clearTimeout(t);
  }, [activeId]);

  const onDown = (e: PointerEvent) => {
    // Horizontal scrollers (hourly strip) keep their own drag.
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
    // Follow the finger by writing the transform directly: no React render per pointer move.
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
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <div className="pager" ref={pagerRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClickCapture={(e) => { if (justDragged.current) { e.stopPropagation(); justDragged.current = false; } }}
        style={{ transform: `translateX(${-idx * 100}%)` }}>
        {cities.map((c, i) => (Math.abs(i - idx) <= 1
          ? <CityPage key={c.id} city={c} isDefault={i === 0} />
          : <div key={c.id} className="page" />))}
      </div>
      <div className="overlay">
        <ActionIcon variant="transparent" c="white" aria-label="Cities" onClick={() => navigate({ name: 'cities' })}>
          <Icon name="list" />
        </ActionIcon>
        <div style={{ display: 'flex', gap: 6 }}>
          {cities.map((c, i) => (
            <button key={c.id} className="dot" data-active={i === idx || undefined}
              aria-label={`Show ${c.name}`} onClick={() => setPage(i)} />
          ))}
        </div>
        <Group gap={0} wrap="nowrap">
          <ActionIcon variant="transparent" c="white" aria-label={updating ? 'Updating' : 'Refresh all'} aria-busy={updating || undefined}
            onClick={() => refreshAll({ maxAgeMs: 0 })}>
            <span className={updating ? 'spin' : undefined}><Icon name="refresh" size={20} /></span>
          </ActionIcon>
          <ActionIcon variant="transparent" c="white" aria-label="Settings" onClick={() => navigate({ name: 'settings' })}>
            <Icon name="sliders" />
          </ActionIcon>
        </Group>
      </div>
    </div>
  );
}
