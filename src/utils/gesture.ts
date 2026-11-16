import { gestureEnd, gestureStart } from '../stores';

const SETTLE_MS = 400;

export const GESTURE = {
  start: gestureStart,
  end: (): void => { setTimeout(gestureEnd, SETTLE_MS); },
};
