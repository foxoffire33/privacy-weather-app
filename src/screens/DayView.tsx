import { useEffect } from 'react';
import { Badge, Box, Button, Group, Text } from '@mantine/core';
import { openDay, useCity, useDay, useDayQuery, useDayRecord, useNormals, useUnits } from '../storesV2';
import { conditionLabel } from '../lib/weatherCodes';
import { compass, fmtDelta, fmtTemp, fmtWind, fullDate, hhmm } from '../lib/format';
import { beaufort, duration, levelName, euAqiLevel, uvAdvice } from '../lib/insights';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section, Stat } from '../components/city/parts';
import { HourlyExplorer } from '../components/charts/HourlyExplorer';
import { ChartSk, SectionSk, Sk } from '../components/Skeletons';
import { t } from '../i18n';

const nums = (a?: (number | null)[]) => (a ?? []).filter((x): x is number => x != null);
const avg = (a?: (number | null)[]) => { const n = nums(a); return n.length ? n.reduce((x, y) => x + y, 0) / n.length : null; };
const max = (a?: (number | null)[]) => { const n = nums(a); return n.length ? Math.max(...n) : null; };
const min = (a?: (number | null)[]) => { const n = nums(a); return n.length ? Math.min(...n) : null; };
const f = (v: number | null | undefined, d = 0) => (v == null ? '–' : v.toFixed(d));

export function DayView({ cityId, date }: { cityId: string; date: string }) {
  const units = useUnits();
  const s = {
    city: useCity(cityId),
    day: useDay(cityId, date),
    query: useDayQuery(cityId, date),
    record: useDayRecord(cityId, date),
    normal: useNormals(cityId)?.[date.slice(5)],
    tempUnit: units.temp,
    windUnit: units.wind,
  };
  useEffect(() => { void openDay(cityId, date); }, [cityId, date]);
  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const W = (k?: number | null) => fmtWind(k, s.windUnit);
  if (!s.city) return <div className="screen"><ScreenHeader /><Text px={20}>{t('common.noLongerFollowed')}</Text></div>;
  const day = s.day;
  const d = day?.daily.v ?? {};
  const h = day?.hourly.v ?? {};
  const hi = d.temperature_2m_max ?? s.record?.hi ?? null;
  const delta = s.normal != null && hi != null ? fmtDelta(hi - s.normal, s.tempUnit) : null;
  const aqi = day?.air ? Object.fromEntries(day.air.time.map((t, i) => [t, day.air!.v.european_aqi?.[i] ?? null])) : undefined;
  const aqiMax = max(day?.air?.v.european_aqi);
  const aqiLvl = euAqiLevel(aqiMax);
  return (
    <div className="screen">
      <div className="hero" style={{ paddingTop: 8 }}>
        <Box ml={-12} mb={8} c="white"><ScreenHeader /></Box>
        <Group gap={8}>
          <Text fz={15} fw={800}>{s.city.name}</Text>
          {s.record && <Badge variant="white" color="dark" size="sm">{s.record.source === 'log' ? t('dayView.logged') : t('dayView.filled')}</Badge>}
        </Group>
        <Text fz={13} fw={600}>{fullDate(date)}</Text>
        {hi == null && !day ? (
          <>
            <Sk w={200} h={143} mt={8} />
            <Sk w={140} h={22} mt={14} />
            <Sk w={260} h={14} mt={8} />
          </>
        ) : (
          <>
            <div className="hero-temp">{T(hi)}°</div>
            <Text fz={20} fw={800} mt={8}>{conditionLabel(d.weather_code ?? s.record?.code)}</Text>
            <Text fz={13} fw={600}>
              {t('dayView.lowLine', { lo: T(d.temperature_2m_min ?? s.record?.lo), fhi: T(d.apparent_temperature_max ?? s.record?.feelsHi), flo: T(d.apparent_temperature_min ?? s.record?.feelsLo) })}
              {delta && ` · ${t('city.vsAverage', { delta })}`}
            </Text>
          </>
        )}
      </div>

      {!day && (
        <Box p={s.query.error ? 20 : 0}>
          {s.query.error ? (
            <>
              <Text fw={800}>{t('dayView.couldNotLoad')}</Text>
              <Text fz={13} c="dimmed">{s.query.error}</Text>
              <Button mt={12} variant="outline" color="gray" onClick={() => void openDay(cityId, date)}>{t('common.tryAgain')}</Button>
            </>
          ) : (
            <>
              <Section title={t('dayView.hourByHour')}><ChartSk /></Section>
              <SectionSk title={t('dayView.temperature')} />
              <SectionSk title={t('city.precip.title')} />
              <SectionSk title={t('city.wind.title')} n={2} />
              <SectionSk title={t('city.sun.title')} />
            </>
          )}
        </Box>
      )}

      {day && (
        <>
          <Section title={t('dayView.hourByHour')}>
            <Box pt={12}><HourlyExplorer time={day.hourly.time} v={h} aqi={aqi} /></Box>
          </Section>

          <Section title={t('dayView.temperature')}>
            <div className="stat-grid">
              <Stat k={t('dayView.highLow')} v={`${T(d.temperature_2m_max)}° / ${T(d.temperature_2m_min)}°`} s={s.normal != null ? t('dayView.normalHigh', { t: T(s.normal) }) : undefined} />
              <Stat k={t('city.day.feelsLike')} v={`${T(d.apparent_temperature_max)}° / ${T(d.apparent_temperature_min)}°`} />
              <Stat k={t('city.feels.humidity')} v={`${f(avg(h.relative_humidity_2m))}%`} s={t('dayView.dailyAverage')} />
              <Stat k={t('city.feels.dewPoint')} v={`${T(avg(h.dew_point_2m))}°`} s={t('dayView.dailyAverage')} />
            </div>
          </Section>

          <Section title={t('city.precip.title')}>
            <div className="stat-grid">
              <Stat k={t('city.day.precipitation')} v={`${f(d.precipitation_sum, 1)} mm`} s={t('dayView.wet', { h: f(d.precipitation_hours) })} />
              <Stat k={t('history.rain')} v={`${f(d.rain_sum, 1)} mm`} />
              <Stat k={t('city.day.snowfall')} v={`${f(d.snowfall_sum, 1)} cm`} s={(max(h.snow_depth) ?? 0) > 0 ? t('dayView.snowDepth', { cm: Math.round((max(h.snow_depth) ?? 0) * 100) }) : undefined} />
              {d.precipitation_probability_max != null && <Stat k={t('dayView.forecastChance')} v={`${f(d.precipitation_probability_max)}%`} />}
            </div>
          </Section>

          <Section title={t('city.wind.title')} summary={t('dayView.windSummary', { force: beaufort(d.wind_speed_10m_max ?? null).toLocaleLowerCase(), dir: compass(d.wind_direction_10m_dominant ?? 0) })}>
            <div className="stat-grid">
              <Stat k={t('dayView.maxWind')} v={W(d.wind_speed_10m_max)} />
              <Stat k={t('dayView.maxGusts')} v={W(d.wind_gusts_10m_max)} s={beaufort(d.wind_gusts_10m_max ?? null)} />
            </div>
          </Section>

          <Section title={t('city.sun.title')}>
            <div className="stat-grid">
              <Stat k={t('city.sun.sunrise')} v={hhmm(day.daily.sunrise)} s={t('city.sun.sunsetAt', { time: hhmm(day.daily.sunset) })} />
              <Stat k={t('dayView.daylight')} v={duration(d.daylight_duration ?? null)} s={t('dayView.sunshine', { d: duration(d.sunshine_duration ?? null) })} />
              {d.uv_index_max != null && <Stat k={t('city.day.uvMax')} v={f(d.uv_index_max)} s={uvAdvice(d.uv_index_max)} />}
              <Stat k={t('city.day.solarEnergy')} v={`${f(d.shortwave_radiation_sum, 1)} MJ/m²`} />
            </div>
          </Section>

          <Section title={t('dayView.skyAtmosphere')}>
            <div className="stat-grid">
              <Stat k={t('city.sky.cloudCover')} v={`${f(avg(h.cloud_cover))}%`} s={t('dayView.dailyAverage')} />
              <Stat k={t('city.atmosphere.pressure')} v={`${f(min(h.pressure_msl))}–${f(max(h.pressure_msl))}`} s={t('dayView.pressureNote')} />
              <Stat k={t('city.atmosphere.evaporation')} v={`${f(d.et0_fao_evapotranspiration, 1)} mm`} s="ET₀" />
              {h.cape && <Stat k={t('dayView.maxCape')} v={f(max(h.cape))} s={t('dayView.capeNote')} />}
            </div>
          </Section>

          {day.air && (
            <Section title={t('city.air.title')} summary={t('dayView.airSummary', { v: f(aqiMax), level: aqiLvl != null ? levelName(aqiLvl) : '–' })}>
              <div className="stat-grid">
                <Stat k={t('dayView.pm25')} v={`${f(avg(day.air.v.pm2_5))} µg/m³`} />
                <Stat k={t('dayView.pm10')} v={`${f(avg(day.air.v.pm10))} µg/m³`} />
                <Stat k={t('dayView.no2')} v={`${f(avg(day.air.v.nitrogen_dioxide))} µg/m³`} />
                <Stat k={t('dayView.ozoneMax')} v={`${f(max(day.air.v.ozone))} µg/m³`} />
              </div>
            </Section>
          )}

          <Text px={12} py={20} fz={12} c="dimmed">
            {day.source === 'forecast' ? t('dayView.sourceForecast') : t('dayView.sourceArchive')} · {t('common.dataBy')}
          </Text>
        </>
      )}
    </div>
  );
}
