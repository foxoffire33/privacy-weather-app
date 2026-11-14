import { Box } from '@mantine/core';
import { animate, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { t } from '../i18n';
import { MOTION } from '../theme';

import { MotionBox, MotionButton } from './motionComponents';

import type { SwipeRowProps } from '../types';
import type { PanInfo } from 'motion/react';
import type { ReactElement } from 'react';

const ACTION_W = 88;
const OVERDRAG = 0.9;
const DELETE_AT = 0.6;

export function SwipeRow({ open, onOpenChange, onDelete, onEdit, disabled, label, children }: SwipeRowProps): ReactElement {
  const [removing, setRemoving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const swallowClick = useRef(false);
  const actionsW = onEdit === undefined ? ACTION_W : ACTION_W * 2;
  const x = useMotionValue(0);
  const editShare = useMotionValue(onEdit === undefined ? 0 : ACTION_W);
  const deleteW = useTransform(() => Math.max(ACTION_W, -x.get() - editShare.get()));
  useEffect(() => {
    if (removing) { return; }
    const controls = animate(x, open ? -actionsW : 0, MOTION.quick);
    return () => { controls.stop(); };
  }, [open, actionsW, removing, x]);
  const deleteNow = useEffectEvent(() => { onDelete(); });
  useEffect(() => {
    if (!removing) { return; }
    let done = false;
    const finish = () => {
      if (done) { return; }
      done = true;
      deleteNow();
    };
    const controls = animate(x, -(root.current?.offsetWidth ?? 420), MOTION.quick);
    void controls.then(finish);
    return () => {
      controls.stop();
      finish();
    };
  }, [removing, x]);
  const remove = () => {
    if (removing) { return; }
    editShare.set(0);
    setRemoving(true);
  };
  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    const width = root.current?.offsetWidth ?? 420;
    const at = x.get() + info.velocity.x * 0.1;
    if (at < -width * DELETE_AT) { remove(); return; }
    const shouldOpen = at < -actionsW / 2;
    if (shouldOpen === open) { animate(x, open ? -actionsW : 0, MOTION.quick); }
    onOpenChange(shouldOpen);
  };
  return (
    <Box ref={root} style={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y' }}
      onPointerDown={() => { swallowClick.current = false; }}
      onClickCapture={(e) => {
        if (swallowClick.current || (open && !(e.target instanceof Element && e.target.closest('[data-swipe-action]') !== null))) {
          e.preventDefault();
          e.stopPropagation();
          if (!swallowClick.current) { onOpenChange(false); }
          swallowClick.current = false;
        }
      }}>
      <MotionButton data-swipe-action onClick={remove} tabIndex={open ? 0 : -1} aria-hidden={!open}
        aria-label={t('history.deleteLabel', { date: label })}
        style={{
          position: 'absolute', top: 0, bottom: 0, right: 0, width: deleteW,
          border: 0, background: '#ff3b30', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 18, cursor: 'pointer',
        }}>
        {t('history.delete')}
      </MotionButton>
      {onEdit !== undefined && !removing && (
        <MotionButton data-swipe-action onClick={() => { onOpenChange(false); onEdit(); }} tabIndex={open ? 0 : -1} aria-hidden={!open}
          aria-label={t('history.editLabel', { date: label })}
          style={{
            position: 'absolute', top: 0, bottom: 0, right: deleteW, width: ACTION_W,
            border: 0, background: '#8e8e93', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
          {t('dayView.edit')}
        </MotionButton>
      )}
      <MotionBox drag={disabled === true || removing ? false : 'x'} dragDirectionLock dragMomentum={false}
        dragConstraints={{ left: -actionsW, right: 0 }} dragElastic={{ left: OVERDRAG, right: 0 }}
        onDragStart={() => { swallowClick.current = true; }} onDragEnd={onDragEnd}
        style={{ x, position: 'relative', background: 'var(--mantine-color-body)', touchAction: 'pan-y' }}>
        {children}
      </MotionBox>
    </Box>
  );
}
