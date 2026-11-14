import { z } from 'zod';

import { t } from '../i18n';

import { convTemp, convWind, tempToCelsius, windToKmh } from './format';

import type { DayEntry, DayRecord, Units } from '../stores';
import type { DayFormValues, FormNumber } from '../types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SECONDS_PER_HOUR = 3600;

const blank = (v: number | null | undefined): FormNumber => v ?? '';
const value = (v: FormNumber): number | null => (v === '' ? null : v);
const oneDecimal = (v: number): number => Math.round(v * 10) / 10;

function bounded(min: number, max: number) {
  const message = t('dayForm.errors.range', { min: String(min), max: String(max) });
  return z.union([z.number().min(min, message).max(max, message), z.literal('')]);
}

function ordered(low: FormNumber, high: FormNumber): boolean {
  return low === '' || high === '' || low <= high;
}

export function dayFormSchema(units: Units, today: string): z.ZodType<DayFormValues> {
  const lowTemp = Math.round(convTemp(-90, units.temp) ?? -90);
  const highTemp = Math.round(convTemp(60, units.temp) ?? 60);
  const maxWind = Math.round(convWind(500, units.wind) ?? 500);
  return z.object({
    date: z.string().regex(DATE, t('dayForm.errors.date')).refine((d) => d <= today, t('dayForm.errors.date')),
    hi: bounded(lowTemp, highTemp),
    lo: bounded(lowTemp, highTemp),
    feelsHi: bounded(lowTemp, highTemp),
    feelsLo: bounded(lowTemp, highTemp),
    mm: bounded(0, 2000),
    snow: bounded(0, 1000),
    wind: bounded(0, maxWind),
    gust: bounded(0, maxWind),
    sunshine: bounded(0, 24),
    uv: bounded(0, 20),
    code: z.string(),
  })
    .refine((v) => ordered(v.lo, v.hi), { path: ['lo'], message: t('dayForm.errors.lowAboveHigh') })
    .refine((v) => ordered(v.feelsLo, v.feelsHi), { path: ['feelsLo'], message: t('dayForm.errors.lowAboveHigh') })
    .refine((v) => ordered(v.wind, v.gust), { path: ['gust'], message: t('dayForm.errors.gustBelowWind') });
}

const EMPTY_RECORD: Partial<DayRecord> = {};

export function dayFormValues(date: string, record: DayRecord | undefined, units: Units): DayFormValues {
  const r = record ?? EMPTY_RECORD;
  const temp = (v: number | null | undefined) => blank(convTemp(v, units.temp));
  const wind = (v: number | null | undefined) => blank(convWind(v, units.wind));
  const sunshine = r.sunshine ?? null;
  const code = r.code ?? null;
  return {
    date,
    hi: temp(r.hi),
    lo: temp(r.lo),
    feelsHi: temp(r.feelsHi),
    feelsLo: temp(r.feelsLo),
    mm: blank(r.mm),
    snow: blank(r.snow),
    wind: wind(r.wind),
    gust: wind(r.gust),
    sunshine: sunshine === null ? '' : oneDecimal(sunshine / SECONDS_PER_HOUR),
    uv: blank(r.uv),
    code: code === null ? '' : String(code),
  };
}

export function dayEntryFrom(values: DayFormValues, units: Units): DayEntry {
  const temp = (v: FormNumber) => { const n = value(v); return n === null ? null : oneDecimal(tempToCelsius(n, units.temp)); };
  const wind = (v: FormNumber) => { const n = value(v); return n === null ? null : oneDecimal(windToKmh(n, units.wind)); };
  const hours = value(values.sunshine);
  return {
    hi: temp(values.hi),
    lo: temp(values.lo),
    feelsHi: temp(values.feelsHi),
    feelsLo: temp(values.feelsLo),
    mm: value(values.mm),
    snow: value(values.snow),
    wind: wind(values.wind),
    gust: wind(values.gust),
    sunshine: hours === null ? null : hours * SECONDS_PER_HOUR,
    uv: value(values.uv),
    code: values.code === '' ? null : Number(values.code),
  };
}
