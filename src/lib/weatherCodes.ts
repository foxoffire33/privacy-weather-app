import { t } from '../i18n';

import type { MessageKey } from '../i18n';

const LABELS: Partial<Record<number, MessageKey>> = {
  0: 'weather.0',
  1: 'weather.1',
  2: 'weather.2',
  3: 'weather.3',
  45: 'weather.45',
  48: 'weather.48',
  51: 'weather.51',
  53: 'weather.53',
  55: 'weather.55',
  56: 'weather.56',
  57: 'weather.57',
  61: 'weather.61',
  63: 'weather.63',
  65: 'weather.65',
  66: 'weather.66',
  67: 'weather.67',
  71: 'weather.71',
  73: 'weather.73',
  75: 'weather.75',
  77: 'weather.77',
  80: 'weather.80',
  81: 'weather.81',
  82: 'weather.82',
  85: 'weather.85',
  86: 'weather.86',
  95: 'weather.95',
  96: 'weather.96',
  99: 'weather.99',
};

export const conditionLabel = (code?: number | null): string =>
  labelFor(code === null || code === undefined ? undefined : LABELS[code]);

function labelFor(key: MessageKey | undefined): string {
  return key === undefined ? '—' : t(key);
}
