import { Capacitor, registerPlugin } from '@capacitor/core';

import { ACCENTS, customTuple } from '../theme';
import type { Accent } from '../types';

// Native side: android/.../AppIconPlugin.java. Switches the launcher icon to the accent and
// stores the colour for native widgets. The icon changes when the app goes to the background.
interface AppIconPlugin {
  setAccent(options: { accent: Accent; color: string }): Promise<void>;
}

const AppIcon = registerPlugin<AppIconPlugin>('AppIcon');

/** The accent as one #rrggbb colour: shade 5, black when the accent is off. */
export function accentHex(accent: Accent, accentColor: string): string {
  if (accent === 'off') return '#000000';
  if (accent === 'custom') return customTuple(accentColor)[5];
  return ACCENTS[accent].tuple[5];
}

export function syncAppIcon(accent: Accent, accentColor: string): void {
  if (Capacitor.getPlatform() !== 'android') return;
  AppIcon.setAccent({ accent, color: accentHex(accent, accentColor) }).catch(() => {
    // Older native build without the plugin: keep the current icon.
  });
}
