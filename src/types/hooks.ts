import type { Named, ToggleSeries } from './charts';
import type { PointerEvent, ReactElement, RefObject, TouchEvent, WheelEvent } from 'react';


export interface SeriesToggleApi {
  visible: <T extends Named>(series: T[]) => T[];
  legend: (series: ToggleSeries[]) => ReactElement;
}

export interface DragScrollBind<T extends HTMLElement> {
  ref: RefObject<T | null>;
  'data-noswipe': boolean;
  onPointerDown: (e: PointerEvent<T>) => void;
  onPointerMove: (e: PointerEvent<T>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onWheel: (e: WheelEvent<T>) => void;
}

export interface PullPastTouch {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export interface PullPastMouse {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
}

export interface PullPast {
  armed: boolean;
  indicatorRef: RefObject<HTMLDivElement | null>;
  touch: PullPastTouch;
  mouse: PullPastMouse;
}
