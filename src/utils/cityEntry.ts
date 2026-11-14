import { z } from 'zod';

import { t } from '../i18n';

import type { GeoResult } from '../stores';
import type { CityFormValues } from '../types';

export const EMPTY_CITY: CityFormValues = { name: '', region: '', latitude: '', longitude: '' };

function coordinate(limit: number) {
  const message = t('dayForm.errors.range', { min: String(-limit), max: String(limit) });
  return z.number(t('cityForm.errors.required')).min(-limit, message).max(limit, message);
}

export function cityFormSchema(): z.ZodType<CityFormValues> {
  return z.object({
    name: z.string().trim().min(1, t('cityForm.errors.required')),
    region: z.string(),
    latitude: z.union([coordinate(90), z.literal('')]).refine((v) => v !== '', t('cityForm.errors.required')),
    longitude: z.union([coordinate(180), z.literal('')]).refine((v) => v !== '', t('cityForm.errors.required')),
  });
}

export function geoFromForm(values: CityFormValues): GeoResult {
  return {
    id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: values.name.trim(),
    admin1: values.region.trim() === '' ? undefined : values.region.trim(),
    latitude: values.latitude === '' ? 0 : values.latitude,
    longitude: values.longitude === '' ? 0 : values.longitude,
  };
}
