import { Box, UnstyledButton } from '@mantine/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { t } from '../i18n';

import type { SwipeGesture, SwipeRowProps } from '../types';
import type { PointerEvent, ReactElement } from 'react';

const ACTION_W = 88;
const REMOVE_MS = 220;

export function SwipeRow({ open, onOpenChange, onDelete, onEdit, disabled, label, children }: SwipeRowProps): ReactElement {
  const [dragX, setDragX] = useState<number | null>(null);
  const [removingWidth, setRemovingWidth] = useState<number | null>(null);
  const removing = removingWidth !== null;
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<SwipeGesture | null>(null);
  const swallowClick = useRef(false);
  const actionsW = onEdit === undefined ? ACTION_W : ACTION_W * 2;
  const offset = removingWidth === null ? dragX ?? (open ? -actionsW : 0) : -removingWidth;
  const deleteW = Math.max(ACTION_W, -offset - (onEdit === undefined || removing ? 0 : ACTION_W));
  const remove = () => {
    if (removing) { return; }
    setDragX(null);
    setRemovingWidth(root.current?.offsetWidth ?? 420);
  };
  const deleteNow = useEffectEvent(() => { onDelete(); });
  useEffect(() => {
    if (!removing) { return; }
    let done = false;
    const finish = () => {
      if (done) { return; }
      done = true;
      deleteNow();
    };
    const timer = globalThis.setTimeout(finish, REMOVE_MS);
    return () => {
      globalThis.clearTimeout(timer);
      finish();
    };
  }, [removing]);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (disabled === true || removing || e.button > 0) { return; }
    drag.current = { x: e.clientX, y: e.clientY, base: open ? -actionsW : 0, dir: null, width: e.currentTarget.offsetWidth };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) { return; }
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (d.dir === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) { return; }
      d.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
      if (d.dir === 'h') {
        e.currentTarget.setPointerCapture(e.pointerId);
        swallowClick.current = true;
      }
    }
    if (d.dir !== 'h') { return; }
    const raw = d.base + mx;
    setDragX(Math.min(0, raw < -actionsW ? -actionsW + (raw + actionsW) * 0.9 : raw));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.dir !== 'h' || dragX === null) { setDragX(null); return; }
    const x = dragX;
    setDragX(null);
    if (x < -d.width * 0.6) { remove(); }
    else { onOpenChange(x < -actionsW / 2); }
  };
  return (
    <Box ref={root} style={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y' }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (swallowClick.current || (open && !(e.target instanceof Element && e.target.closest('[data-swipe-action]') !== null))) {
          e.preventDefault();
          e.stopPropagation();
          if (!swallowClick.current) { onOpenChange(false); }
          swallowClick.current = false;
        }
      }}>
      <UnstyledButton data-swipe-action onClick={remove} tabIndex={open ? 0 : -1} aria-hidden={!open}
        aria-label={t('history.deleteLabel', { date: label })}
        style={{
          position: 'absolute', top: 0, bottom: 0, right: 0, width: deleteW,
          border: 0, background: '#ff3b30', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 18, cursor: 'pointer',
          transition: dragX === null ? `width ${String(REMOVE_MS)}ms ease` : 'none',
        }}>
        {t('history.delete')}
      </UnstyledButton>
      {onEdit !== undefined && !removing && (
        <UnstyledButton data-swipe-action onClick={() => { onOpenChange(false); onEdit(); }} tabIndex={open ? 0 : -1} aria-hidden={!open}
          aria-label={t('history.editLabel', { date: label })}
          style={{
            position: 'absolute', top: 0, bottom: 0, right: deleteW, width: ACTION_W,
            border: 0, background: '#8e8e93', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: dragX === null ? `right ${String(REMOVE_MS)}ms ease` : 'none',
          }}>
          {t('dayView.edit')}
        </UnstyledButton>
      )}
      <Box style={{
        position: 'relative', background: 'var(--mantine-color-body)',
        transform: `translateX(${String(offset)}px)`,
        transition: dragX === null ? `transform ${String(REMOVE_MS)}ms ease` : 'none',
      }}>
        {children}
      </Box>
    </Box>
  );
}
