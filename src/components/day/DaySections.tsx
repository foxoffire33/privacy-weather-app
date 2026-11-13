import { Box, Text } from '@mantine/core';

import { t } from '../../i18n';
import { compass, fmtTemp, fmtWind, hhmm } from '../../utils/format';
import { avg, fixed as f, max, min } from '../../utils/stats';
import { beaufort, duration, euAqiLevel, levelName, uvAdvice } from '../../weather/insights';
import { ExpandButton, FullscreenChart } from '../charts/FullscreenChart';
import { HourlyExplorer } from '../charts/HourlyExplorer';
import { Section, Stat } from '../city/Parts';

import type { DayHourlyProps, DaySectionProps, DayTempProps } from '../../types';
import type { ReactElement } from 'react';

export function DayHourly({ day, cityId }: DayHourlyProps): ReactElement {
  const air = day.air;
  const aqi = air ? Object.fromEntries(air.time.map((time, i) => [time, air.v.european_aqi?.[i] ?? null])) : undefined;
  const id = `day:${cityId}:${day.date}`;
  return (
    <Section title={t('dayView.hourByHour')} action={<ExpandButton id={id} />}>
      <Box pt={12}><HourlyExplorer time={day.hourly.time} v={day.hourly.v} aqi={aqi} /></Box>
      <FullscreenChart id={id} title={t('dayView.hourByHour')}
        render={(height) => <HourlyExplorer time={day.hourly.time} v={day.hourly.v} aqi={aqi} height={height} />} />
    </Section>
  );
}

export function DayTemperature({ day, units, normal }: DayTempProps): ReactElement {
  const d = day.daily.v;
  const h = day.hourly.v;
  const T = (c?: number | null) => fmtTemp(c, units.temp);
  return (
    <Section title={t('dayView.temperature')}>
      <Box className="stat-grid">
        <Stat k={t('dayView.highLow')} v={`${T(d.temperature_2m_max)}° / ${T(d.temperature_2m_min)}°`} s={normal === undefined ? undefined : t('dayView.normalHigh', { t: T(normal) })} />
        <Stat k={t('city.day.feelsLike')} v={`${T(d.apparent_temperature_max)}° / ${T(d.apparent_temperature_min)}°`} />
        <Stat k={t('city.feels.humidity')} v={`${f(avg(h.relative_humidity_2m))}%`} s={t('dayView.dailyAverage')} />
        <Stat k={t('city.feels.dewPoint')} v={`${T(avg(h.dew_point_2m))}°`} s={t('dayView.dailyAverage')} />
      </Box>
    </Section>
  );
}

export function DayPrecip({ day }: DaySectionProps): ReactElement {
  const d = day.daily.v;
  const snowDepth = max(day.hourly.v.snow_depth) ?? 0;
  const chance = d.precipitation_probability_max;
  return (
    <Section title={t('city.precip.title')}>
      <Box className="stat-grid">
        <Stat k={t('city.day.precipitation')} v={`${f(d.precipitation_sum, 1)} mm`} s={t('dayView.wet', { h: f(d.precipitation_hours) })} />
        <Stat k={t('history.rain')} v={`${f(d.rain_sum, 1)} mm`} />
        <Stat k={t('city.day.snowfall')} v={`${f(d.snowfall_sum, 1)} cm`} s={snowDepth > 0 ? t('dayView.snowDepth', { cm: Math.round(snowDepth * 100) }) : undefined} />
        {chance !== null && chance !== undefined && <Stat k={t('dayView.forecastChance')} v={`${f(chance)}%`} />}
      </Box>
    </Section>
  );
}

export function DayWind({ day, units }: DaySectionProps): ReactElement {
  const d = day.daily.v;
  const W = (k?: number | null) => fmtWind(k, units.wind);
  return (
    <Section title={t('city.wind.title')} summary={t('dayView.windSummary', { force: beaufort(d.wind_speed_10m_max ?? null).toLocaleLowerCase(), dir: compass(d.wind_direction_10m_dominant ?? 0) })}>
      <Box className="stat-grid">
        <Stat k={t('dayView.maxWind')} v={W(d.wind_speed_10m_max)} />
        <Stat k={t('dayView.maxGusts')} v={W(d.wind_gusts_10m_max)} s={beaufort(d.wind_gusts_10m_max ?? null)} />
      </Box>
    </Section>
  );
}

export function DaySun({ day }: DaySectionProps): ReactElement {
  const d = day.daily.v;
  const uv = d.uv_index_max;
  return (
    <Section title={t('city.sun.title')}>
      <Box className="stat-grid">
        <Stat k={t('city.sun.sunrise')} v={hhmm(day.daily.sunrise)} s={t('city.sun.sunsetAt', { time: hhmm(day.daily.sunset) })} />
        <Stat k={t('dayView.daylight')} v={duration(d.daylight_duration ?? null)} s={t('dayView.sunshine', { d: duration(d.sunshine_duration ?? null) })} />
        {uv !== null && uv !== undefined && <Stat k={t('city.day.uvMax')} v={f(uv)} s={uvAdvice(uv)} />}
        <Stat k={t('city.day.solarEnergy')} v={`${f(d.shortwave_radiation_sum, 1)} MJ/m²`} />
      </Box>
    </Section>
  );
}

export function DaySky({ day }: DaySectionProps): ReactElement {
  const h = day.hourly.v;
  return (
    <Section title={t('dayView.skyAtmosphere')}>
      <Box className="stat-grid">
        <Stat k={t('city.sky.cloudCover')} v={`${f(avg(h.cloud_cover))}%`} s={t('dayView.dailyAverage')} />
        <Stat k={t('city.atmosphere.pressure')} v={`${f(min(h.pressure_msl))}–${f(max(h.pressure_msl))}`} s={t('dayView.pressureNote')} />
        <Stat k={t('city.atmosphere.evaporation')} v={`${f(day.daily.v.et0_fao_evapotranspiration, 1)} mm`} s="ET₀" />
        {h.cape && <Stat k={t('dayView.maxCape')} v={f(max(h.cape))} s={t('dayView.capeNote')} />}
      </Box>
    </Section>
  );
}

export function DayAir({ day }: DaySectionProps): ReactElement | null {
  const air = day.air;
  if (air === null) { return null; }
  const aqiMax = max(air.v.european_aqi);
  const lvl = euAqiLevel(aqiMax);
  return (
    <Section title={t('city.air.title')} summary={t('dayView.airSummary', { v: f(aqiMax), level: lvl === null ? '–' : levelName(lvl) })}>
      <Box className="stat-grid">
        <Stat k={t('dayView.pm25')} v={`${f(avg(air.v.pm2_5))} µg/m³`} />
        <Stat k={t('dayView.pm10')} v={`${f(avg(air.v.pm10))} µg/m³`} />
        <Stat k={t('dayView.no2')} v={`${f(avg(air.v.nitrogen_dioxide))} µg/m³`} />
        <Stat k={t('dayView.ozoneMax')} v={`${f(max(air.v.ozone))} µg/m³`} />
      </Box>
    </Section>
  );
}

export function DaySource({ day }: DaySectionProps): ReactElement {
  return (
    <Text px={12} py={20} fz={12} c="dimmed">
      {day.source === 'forecast' ? t('dayView.sourceForecast') : t('dayView.sourceArchive')} · {t('common.dataBy')}
    </Text>
  );
}
