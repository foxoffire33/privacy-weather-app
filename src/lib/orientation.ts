import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export function allowLandscape(allow: boolean): void {
  if (!Capacitor.isNativePlatform()) { return; }
  const change = allow ? ScreenOrientation.unlock() : ScreenOrientation.lock({ orientation: 'portrait' });
  void change.catch(() => {});
}
