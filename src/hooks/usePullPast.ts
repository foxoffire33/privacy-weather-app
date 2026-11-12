import { useRef, useState, type RefObject, type TouchEvent } from 'react';

const TRIGGER = 64; // px of damped pull needed to load
const MAX = 96;

// Pull a horizontal scroller further right while it is already at its left edge (touch only).
// The pull itself is written straight to the indicator's style, so dragging never re-renders
// the page (that made the gesture stutter). Only `armed` is React state, and it flips at most
// once per gesture. Loading starts on release, never during the drag.
export function usePullPast(ref: RefObject<HTMLElement | null>, onLoad: () => void, enabled: boolean) {
  const indicator = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const pull = useRef(0);
  const frame = useRef(0);
  const [armed, setArmed] = useState(false);

  // Width is set in an animation frame so several touchmove events in one frame cost one write.
  // While the finger is down the width must follow it exactly, so the CSS transition is off;
  // it comes back for the spring-back after release.
  const paint = () => {
    frame.current = 0;
    const el = indicator.current;
    if (!el) return;
    el.style.transition = start.current == null ? '' : 'none';
    el.style.width = `${pull.current}px`;
  };
  const set = (v: number) => {
    pull.current = v;
    if (!frame.current) frame.current = requestAnimationFrame(paint);
    const next = v >= TRIGGER;
    setArmed((prev) => (prev === next ? prev : next));
  };
  const end = (load: boolean) => {
    if (start.current == null) return;
    start.current = null;
    const fire = load && pull.current >= TRIGGER;
    set(0);
    paint(); // settle immediately, with the transition back on
    if (fire) onLoad();
  };

  return {
    armed,
    indicatorRef: indicator,
    touch: {
      onTouchStart: (e: TouchEvent) => {
        start.current = enabled && (ref.current?.scrollLeft ?? 1) <= 0 ? e.touches[0].clientX : null;
      },
      onTouchMove: (e: TouchEvent) => {
        if (start.current == null) return;
        const d = e.touches[0].clientX - start.current;
        if (d <= 0 || (ref.current?.scrollLeft ?? 0) > 0) { if (pull.current) set(0); return; }
        set(Math.min(MAX, d * 0.5));
      },
      onTouchEnd: () => end(true),
      onTouchCancel: () => end(false),
    },
  };
}
