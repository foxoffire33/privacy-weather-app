let active = 0;
let waiting: (() => void)[] = [];

export function gestureStart(): void {
  active++;
}

export function gestureEnd(): void {
  active = Math.max(0, active - 1);
  if (active > 0) { return; }
  const run = waiting;
  waiting = [];
  for (const resume of run) { resume(); }
}

export async function afterGesture(): Promise<void> {
  if (active === 0) { return; }
  await new Promise<void>((resolve) => { waiting.push(resolve); });
}
