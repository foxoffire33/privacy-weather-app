import { useRef, useState } from 'react';

import type { PullPast } from '../types';
import type { PointerEvent, RefObject, TouchEvent } from 'react';

const TRIGGER = 64;
const notTouch = (e: PointerEvent) => e.pointerType !== 'touch';
const MAX = 96;

export function usePullPast(ref: RefObject<HTMLElement | null>, onLoad: () => void, enabled: boolean): PullPast {
  const indicator = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const pull = useRef(0);
  const frame = useRef(0);
  const [armed, setArmed] = useState(false);
  const paint = () => {
    frame.current = 0;
    const el = indicator.current;
    if (!el) {return;}
    el.style.transition = start.current === null ? '' : 'none';
    el.style.width = `${String(pull.current)}px`;
  };
  const set = (v: number) => {
    pull.current = v;
    if (frame.current === 0) {frame.current = requestAnimationFrame(paint);}
    const next = v >= TRIGGER;
    setArmed((prev) => (prev === next ? prev : next));
  };
  const end = (load: boolean) => {
    if (start.current === null) {return;}
    start.current = null;
    const fire = load && pull.current >= TRIGGER;
    set(0);
    paint();
    if (fire) {onLoad();}
  };
  const begin = (x: number) => {
    start.current = enabled && (ref.current?.scrollLeft ?? 1) <= 0 ? x : null;
  };
  const move = (x: number) => {
    if (start.current === null) {return;}
    const d = x - start.current;
    if (d <= 0 || (ref.current?.scrollLeft ?? 0) > 0) { if (pull.current !== 0) {set(0);} return; }
    set(Math.min(MAX, d * 0.5));
  };
  return {
    armed,
    indicatorRef: indicator,
    touch: {
      onTouchStart: (e: TouchEvent) => { begin(e.touches[0].clientX); },
      onTouchMove: (e: TouchEvent) => { move(e.touches[0].clientX); },
      onTouchEnd: () => { end(true); },
      onTouchCancel: () => { end(false); },
    },
    mouse: {
      onPointerDown: (e: PointerEvent) => { if (notTouch(e)) {begin(e.clientX);} },
      onPointerMove: (e: PointerEvent) => { if (notTouch(e) && start.current !== null) {move(e.clientX);} },
      onPointerUp: (e: PointerEvent) => { if (notTouch(e)) {end(true);} },
      onPointerCancel: (e: PointerEvent) => { if (notTouch(e)) {end(false);} },
    },
  };
}
