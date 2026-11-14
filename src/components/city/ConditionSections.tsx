import { Box, Group, Progress, Text } from '@mantine/core';

import { t } from '../../i18n';
import { compass, fmtTemp, fmtWind, hhmm } from '../../utils/format';
import { beaufort, dewLabel, duration, feelsLabel, nowIndex, signedMinutes, sunProgress, uvAdvice } from '../../utils/insights';
import { Icon } from '../Icon';

import { n0 } from './num';
import { Section, Stat } from './Parts';

import type { MessageKey } from '../../i18n';
import type { EntryProps } from '../../types';
import type { ReactElement } from 'react';

function feelsKey(windChill: number): MessageKey {
  if (Math.abs(windChill) < 1) { return 'city.feels.close'; }
  return windChill < 0 ? 'city.feels.colder' : 'city.feels.warmer';
}

export function FeelsSection({ entry, units }: EntryProps): ReactElement {
  const c = entry.data.current.v;
  const dv = entry.data.daily.v;
  const d = entry.pastDays;
  const T = (v?: number | null) => fmtTemp(v, units.temp);
  const windChill = c.apparent_temperature !== null && c.temperature_2m !== null ? c.apparent_temperature - c.temperature_2m : 0;
  return (
    <Section title={t('city.feels.title')} summary={t(feelsKey(windChill), { label: feelsLabel(c.apparent_temperature), n: Math.abs(Math.round(windChill)) })}>
      <Box className="stat-grid">
        <Stat k={t('city.feels.title')} v={`${T(c.apparent_temperature)}°`} s={t('city.feels.air', { t: T(c.temperature_2m) })} />
        <Stat k={t('city.feels.humidity')} v={`${n0(c.relative_humidity_2m)}%`} s={dewLabel(c.dew_point_2m)} />
        <Stat k={t('city.feels.dewPoint')} v={`${T(c.dew_point_2m)}°`} />
        <Stat k={t('city.feels.todayFeels')} v={`${T(dv.apparent_temperature_max[d])}° / ${T(dv.apparent_temperature_min[d])}°`} s={t('city.feels.maxMin')} />
      </Box>
    </Section>
  );
}

export function SunSection({ entry }: EntryProps): ReactElement {
  const { data, pastDays: d } = entry;
  const c = data.current.v;
  const dv = data.daily.v;
  const daylightToday = dv.daylight_duration.at(d) ?? null;
  const daylightBefore = d > 0 ? dv.daylight_duration[d - 1] ?? null : null;
  const change = daylightToday !== null && daylightBefore !== null ? daylightToday - daylightBefore : null;
  const sunPos = sunProgress(data.current.time, data.daily.sunrise[d], data.daily.sunset[d]);
  const isDay = c.is_day !== null && c.is_day !== 0;
  return (
    <Section title={t('city.sun.title')} summary={change === null ? undefined : t('city.sun.summary', { daylight: duration(daylightToday), change: signedMinutes(change) })}>
      <Box py={12} className="row">
        <Group justify="space-between" mb={6}>
          <Text fz={20} fw={800}>{hhmm(data.daily.sunrise[d])}</Text>
          <Text fz={20} fw={800}>{hhmm(data.daily.sunset[d])}</Text>
        </Group>
        <Progress size={6} value={(sunPos ?? (isDay ? 1 : 0)) * 100} color="signal.4" />
        <Group justify="space-between" mt={4}>
          <Text fz={12} c="dimmed">{t('city.sun.sunrise')}</Text>
          <Text fz={12} c="dimmed">{sunPos === null ? t('city.sun.sunDown') : t('city.sun.passed', { p: Math.round(sunPos * 100) })}</Text>
          <Text fz={12} c="dimmed">{t('city.sun.sunset')}</Text>
        </Group>
      </Box>
      <Box className="stat-grid">
        <Stat k={t('city.sun.uvNow')} v={n0(c.uv_index)} s={uvAdvice(c.uv_index)} />
        <Stat k={t('city.sun.uvMaxToday')} v={n0(dv.uv_index_max[d])} s={t('city.sun.clearSkyMax', { v: n0(dv.uv_index_clear_sky_max[d]) })} />
        <Stat k={t('city.sun.sunshineToday')} v={duration(dv.sunshine_duration[d])} />
        <Stat k={t('common.tomorrow')} v={hhmm(data.daily.sunrise[d + 1])} s={t('city.sun.sunsetAt', { time: hhmm(data.daily.sunset[d + 1]) })} />
      </Box>
    </Section>
  );
}

export function PrecipSection({ entry }: EntryProps): ReactElement {
  const { data, pastDays: d } = entry;
  const c = data.current.v;
  const dv = data.daily.v;
  const snowDepth = data.hourly.v.snow_depth[nowIndex(data)] ?? 0;
  return (
    <Section title={t('city.precip.title')}>
      <Box className="stat-grid">
        <Stat k={t('common.now')} v={`${n0(c.precipitation, 1)} mm`} s={t('city.precip.nowDetail', { rain: n0(c.rain, 1), showers: n0(c.showers, 1), snow: n0(c.snowfall, 1) })} />
        <Stat k={t('common.today')} v={`${n0(dv.precipitation_sum[d], 1)} mm`} s={t('city.precip.todayDetail', { h: n0(dv.precipitation_hours[d]), p: dv.precipitation_probability_max[d] ?? 0 })} />
        <Stat k={t('city.precip.snowfallToday')} v={`${n0(dv.snowfall_sum[d], 1)} cm`} s={snowDepth > 0 ? t('city.precip.snowOnGround', { cm: Math.round(snowDepth * 100) }) : t('city.precip.noSnow')} />
        <Stat k={t('common.tomorrow')} v={`${n0(dv.precipitation_sum[d + 1], 1)} mm`} s={t('city.precip.chance', { p: dv.precipitation_probability_max[d + 1] ?? 0 })} />
      </Box>
    </Section>
  );
}

export function WindSection({ entry, units }: EntryProps): ReactElement {
  const c = entry.data.current.v;
  const dv = entry.data.daily.v;
  const d = entry.pastDays;
  const W = (v?: number | null) => fmtWind(v, units.wind);
  const dir = c.wind_direction_10m ?? 0;
  return (
    <Section title={t('city.wind.title')} summary={t('city.wind.summary', { force: beaufort(c.wind_speed_10m), dir: compass(dir) })}>
      <Box className="stat-grid">
        <Stat k={t('city.wind.title')} v={W(c.wind_speed_10m)} s={
          <Group gap={4} component="span">
            <Box component="span" style={{ display: 'inline-flex', transform: `rotate(${String(dir + 180)}deg)` }}><Icon name="arrowUp" size={12} /></Box>
            {t('city.wind.from', { dir: compass(dir), deg: n0(c.wind_direction_10m) })}
          </Group>
        } />
        <Stat k={t('city.wind.gusts')} v={W(c.wind_gusts_10m)} s={beaufort(c.wind_gusts_10m)} />
        <Stat k={t('city.wind.maxToday')} v={W(dv.wind_speed_10m_max[d])} s={t('city.wind.gustsUpTo', { v: W(dv.wind_gusts_10m_max[d]) })} />
        <Stat k={t('common.tomorrow')} v={W(dv.wind_speed_10m_max[d + 1])} s={t('city.wind.gustsUpTo', { v: W(dv.wind_gusts_10m_max[d + 1]) })} />
      </Box>
    </Section>
  );
}
