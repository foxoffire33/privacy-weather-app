import { t, type MessageKey } from '../i18n';

// WMO weather interpretation codes (Open-Meteo); the names live in the translation files.
const KNOWN = new Set([0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);

export const conditionLabel = (code?: number | null) =>
  (code == null || !KNOWN.has(code) ? '—' : t(`weather.${code}` as MessageKey));
