import { useRef, useState, type RefObject, type TouchEvent } from 'react';

const TRIGGER = 64; // px of damped pull needed to load
const MAX = 96;

// Pull a horizontal scroller further right while it is already at its left edge (touch only).
// The pull distance is transient gesture state; loading goes through the store.
export function usePullPast(ref: RefObject<HTMLElement | null>, onLoad: () => void, enabled: boolean) {
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const set = (v: number) => { pullRef.current = v; setPull(v); };

  return {
    pull,
    armed: pull >= TRIGGER,
    touch: {
      onTouchStart: (e: TouchEvent) => { start.current = enabled && (ref.current?.scrollLeft ?? 1) <= 0 ? e.touches[0].clientX : null; },
      onTouchMove: (e: TouchEvent) => {
        if (start.current == null) return;
        const d = e.touches[0].clientX - start.current;
        if (d <= 0 || (ref.current?.scrollLeft ?? 0) > 0) { if (pullRef.current) set(0); return; }
        set(Math.min(MAX, d * 0.5));
      },
      onTouchEnd: () => {
        if (start.current == null) return;
        start.current = null;
        if (pullRef.current >= TRIGGER) onLoad();
        set(0);
      },
      onTouchCancel: () => { start.current = null; set(0); },
    },
  };
}
