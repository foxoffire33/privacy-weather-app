import { Box, UnstyledButton } from '@mantine/core';
import { useEffect, useRef, useState    } from 'react';

import { t } from '../i18n';

import type {CSSProperties, PointerEvent, ReactNode} from 'react';

const ACTION_W = 88;
const REMOVE_MS = 220;

export function SwipeRow({ open, onOpenChange, onDelete, disabled, label, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  const [dragX, setDragX] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; base: number; dir: 'h' | 'v' | null; width: number } | null>(null);
  const swallowClick = useRef(false);
  const width = root.current?.offsetWidth ?? 420;
  const offset = removing ? -width : dragX ?? (open ? -ACTION_W : 0);
  const remove = () => {
    if (removing) {return;}
    setDragX(null);
    setRemoving(true);
  };
  useEffect(() => {
    if (!removing) {return;}
    const timer = globalThis.setTimeout(onDelete, REMOVE_MS);
    return () => { globalThis.clearTimeout(timer); };
  }, [removing]);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (disabled || removing || e.button > 0) {return;}
    drag.current = { x: e.clientX, y: e.clientY, base: open ? -ACTION_W : 0, dir: null, width: e.currentTarget.offsetWidth };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {return;}
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.dir) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) {return;}
      d.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
      if (d.dir === 'h') {
        e.currentTarget.setPointerCapture(e.pointerId);
        swallowClick.current = true;
      }
    }
    if (d.dir !== 'h') {return;}
    const raw = d.base + mx;
    setDragX(Math.min(0, raw < -ACTION_W ? -ACTION_W + (raw + ACTION_W) * 0.9 : raw));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.dir !== 'h' || dragX == null) { setDragX(null); return; }
    const x = dragX;
    setDragX(null);
    if (x < -d.width * 0.6) {remove();}
    else {onOpenChange(x < -ACTION_W / 2);}
  };
  return (
    <Box ref={root} className="swipe-row" data-dragging={dragX != null || undefined}
      style={{ '--swipe-w': `${Math.max(ACTION_W, -offset)}px`, '--swipe-x': `${offset}px` }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (swallowClick.current || (open && !(e.target as HTMLElement).closest('[data-swipe-action]'))) {
          e.preventDefault();
          e.stopPropagation();
          if (!swallowClick.current) {onOpenChange(false);}
          swallowClick.current = false;
        }
      }}>
      <UnstyledButton data-swipe-action onClick={remove} tabIndex={open ? 0 : -1} aria-hidden={!open}
        aria-label={t('history.deleteLabel', { date: label })}>
        {t('history.delete')}
      </UnstyledButton>
      <Box className="swipe-content">
        {children}
      </Box>
    </Box>
  );
}
