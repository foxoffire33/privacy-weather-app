import { Capacitor, registerPlugin } from '@capacitor/core';

import { ACCENTS, customTuple } from '../theme';
import type { Accent } from '../stores';

interface AppIconPlugin {
  setAccent(options: { accent: Accent; color: string }): Promise<void>;
}

const AppIcon = registerPlugin<AppIconPlugin>('AppIcon');

export function accentHex(accent: Accent, accentColor: string): string {
  if (accent === 'off') return '#000000';
  if (accent === 'custom') return customTuple(accentColor)[5];
  return ACCENTS[accent].tuple[5];
}

export function syncAppIcon(accent: Accent, accentColor: string): void {
  if (Capacitor.getPlatform() !== 'android') return;
  AppIcon.setAccent({ accent, color: accentHex(accent, accentColor) }).catch(() => {
  });
}
