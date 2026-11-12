import { useRef } from 'react';

// Horizontal scroller that also works with a mouse: drag to scroll, vertical wheel scrolls sideways.
// Touch uses native scrolling. Mark the element data-noswipe so the city pager ignores it.
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  return {
    ref,
    'data-noswipe': true,
    onPointerDown: (e: React.PointerEvent<T>) => {
      if (e.pointerType !== 'mouse' || !ref.current) return;
      drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
    },
    onPointerMove: (e: React.PointerEvent<T>) => {
      const d = drag.current;
      if (!d || !ref.current) return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 4) { d.moved = true; ref.current.setPointerCapture(e.pointerId); }
      if (d.moved) ref.current.scrollLeft = d.left - dx;
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
    onWheel: (e: React.WheelEvent<T>) => {
      if (!ref.current || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const el = ref.current;
      const atEnd = (e.deltaY > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) || (e.deltaY < 0 && el.scrollLeft <= 0);
      if (!atEnd) el.scrollLeft += e.deltaY;
    },
  };
}
