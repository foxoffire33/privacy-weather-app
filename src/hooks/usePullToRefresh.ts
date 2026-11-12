import { useRef, useState, type MouseEvent, type TouchEvent } from 'react';

const TRIGGER = 64; // px of (damped) pull needed to refresh
const MAX = 96;

// Pull down at the top of a scroll container to refresh.
// Pull distance is transient gesture state; the data refresh itself goes through the store.
export function usePullToRefresh(onRefresh: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

  const begin = (y: number, target?: EventTarget | null) => {
    if ((target as HTMLElement | null)?.closest?.('[data-noswipe]')) { start.current = null; return; }
    start.current = (ref.current?.scrollTop ?? 1) <= 0 ? y : null;
  };
  const move = (y: number) => {
    if (start.current == null) return;
    const d = y - start.current;
    if (d <= 0 || (ref.current?.scrollTop ?? 0) > 0) { setPull(0); return; }
    setPull(Math.min(MAX, d * 0.5));
  };
  const end = () => {
    if (start.current == null) return;
    start.current = null;
    if (pull >= TRIGGER) onRefresh();
    setPull(0);
  };

  return {
    pull,
    armed: pull >= TRIGGER,
    bind: {
      ref,
      onTouchStart: (e: TouchEvent) => begin(e.touches[0].clientY, e.target),
      onTouchMove: (e: TouchEvent) => move(e.touches[0].clientY),
      onTouchEnd: end,
      onMouseDown: (e: MouseEvent) => begin(e.clientY, e.target),
      onMouseMove: (e: MouseEvent) => { if (e.buttons) move(e.clientY); },
      onMouseUp: end,
      onMouseLeave: end,
    },
  };
}
