import { ActionIcon, Box, Group, Text } from '@mantine/core';

import { t } from '../../i18n';
import { ago, compass, fmtTemp, orDash } from '../../lib/format';
import { capeLabel, nowIndex, pressureTrend, visibilityLabel } from '../../lib/insights';
import { refreshCity } from '../../stores';
import { Icon } from '../Icon';

import { n0 } from './num';
import { Bar, Section, Stat } from './Parts';

import type { ForecastData } from '../../stores';
import type { CityFooterProps, EntryProps, NowcastProps } from '../../types';
import type { ReactElement } from 'react';

function pressureNote(data: ForecastData): string {
  const trend = pressureTrend(data, nowIndex(data));
  if (trend === null) { return t('city.atmosphere.seaLevel'); }
  const sign = trend.delta >= 0 ? '+' : '−';
  return t('city.atmosphere.trend', { label: trend.label, delta: `${sign}${Math.abs(trend.delta).toFixed(1)}` });
}

function visibilityText(m: number | null): string {
  if (m === null) { return '–'; }
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function SkySection({ entry }: NowcastProps): ReactElement {
  const { data } = entry;
  const c = data.current.v;
  const hv = data.hourly.v;
  const h0 = nowIndex(data);
  return (
    <Section title={t('city.sky.title')}>
      <Box className="stat-grid">
        <Stat k={t('city.sky.cloudCover')} v={`${n0(c.cloud_cover)}%`}><Bar pct={c.cloud_cover ?? 0} color="var(--mantine-color-dark-1)" /></Stat>
        <Stat k={t('city.sky.visibility')} v={visibilityText(c.visibility)} s={visibilityLabel(c.visibility)} />
        <Stat k={t('city.sky.lowClouds')} v={`${n0(hv.cloud_cover_low[h0])}%`} s={t('city.sky.below3')}><Bar pct={hv.cloud_cover_low[h0] ?? 0} color="var(--mantine-color-dark-2)" /></Stat>
        <Stat k={t('city.sky.midHigh')} v={`${n0(hv.cloud_cover_mid[h0])}% / ${n0(hv.cloud_cover_high[h0])}%`} s={t('city.sky.midHighNote')} />
      </Box>
    </Section>
  );
}

export function AtmosphereSection({ entry }: NowcastProps): ReactElement {
  const { data, pastDays: d } = entry;
  const hv = data.hourly.v;
  const h0 = nowIndex(data);
  return (
    <Section title={t('city.atmosphere.title')}>
      <Box className="stat-grid">
        <Stat k={t('city.atmosphere.pressure')} v={`${n0(data.current.v.pressure_msl)} hPa`} s={pressureNote(data)} />
        <Stat k={t('city.atmosphere.thunder')} v={capeLabel(hv.cape[h0])} s={`CAPE ${n0(hv.cape[h0])} J/kg`} />
        <Stat k={t('city.atmosphere.freezing')} v={orDash(hv.freezing_level_height.at(h0), (n) => `${String(Math.round(n))} m`)} s={t('city.atmosphere.freezingNote')} />
        <Stat k={t('city.atmosphere.evaporation')} v={`${n0(data.daily.v.et0_fao_evapotranspiration[d], 1)} mm`} s={t('city.atmosphere.evaporationNote')} />
      </Box>
    </Section>
  );
}

export function SeaSection({ entry, units }: EntryProps): ReactElement | null {
  const { marine } = entry;
  if (marine === null) { return null; }
  const m = marine.current;
  return (
    <Section title={t('city.sea.title')}>
      <Box className="stat-grid">
        <Stat k={t('city.sea.waves')} v={orDash(m.wave_height, (n) => `${n.toFixed(1)} m`)} s={t('city.sea.wavesNote', { dir: compass(m.wave_direction ?? 0), s: n0(m.wave_period) })} />
        <Stat k={t('city.sea.swell')} v={orDash(m.swell_wave_height, (n) => `${n.toFixed(1)} m`)} />
        <Stat k={t('city.sea.temperature')} v={`${fmtTemp(m.sea_surface_temperature, units.temp)}°`} />
      </Box>
    </Section>
  );
}

export function CityFooter({ city, entry, loading }: CityFooterProps): ReactElement {
  return (
    <Group justify="space-between" px={12} pt={12} pb={24} wrap="nowrap" align="flex-start">
      <Box>
        <Text fz={12} c="dimmed">{city.lat.toFixed(2)}°, {city.lon.toFixed(2)}° · {Math.round(entry.data.elevation)} m · {entry.data.timezone}</Text>
        <Text fz={12} c="dimmed">{t('city.footer', { ago: ago(entry.fetchedAt) })}</Text>
      </Box>
      <ActionIcon size={36} aria-label={loading ? t('common.updating') : t('common.refresh')} aria-busy={loading || undefined}
        onClick={() => void refreshCity(city.id, { maxAgeMs: 0 })}>
        <Box component="span" className={loading ? 'spin' : undefined}><Icon name="refresh" size={16} /></Box>
      </ActionIcon>
    </Group>
  );
}
