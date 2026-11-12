import { useEffect } from 'react';
import { Badge, Box, Button, Group, Text } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../store';
import { conditionLabel } from '../lib/weatherCodes';
import { compass, fmtDelta, fmtTemp, fmtWind, fullDate, hhmm } from '../lib/format';
import { beaufort, duration, LEVELS, euAqiLevel, uvAdvice } from '../lib/insights';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section, Stat } from '../components/city/parts';
import { HourlyExplorer } from '../components/charts/HourlyExplorer';
import { ChartSk, SectionSk, Sk } from '../components/Skeletons';

const nums = (a?: (number | null)[]) => (a ?? []).filter((x): x is number => x != null);
const avg = (a?: (number | null)[]) => { const n = nums(a); return n.length ? n.reduce((x, y) => x + y, 0) / n.length : null; };
const max = (a?: (number | null)[]) => { const n = nums(a); return n.length ? Math.max(...n) : null; };
const min = (a?: (number | null)[]) => { const n = nums(a); return n.length ? Math.min(...n) : null; };
const f = (v: number | null | undefined, d = 0) => (v == null ? '–' : v.toFixed(d));

// A logged (or looked-up) day loaded in full, laid out like the city page.
export function DayView({ cityId, date }: { cityId: string; date: string }) {
  const key = `${cityId}:${date}`;
  const s = useWeatherStore(useShallow((st) => ({
    city: st.cities.find((c) => c.id === cityId),
    day: st.days[key],
    status: st.dayStatus[key],
    record: st.history[cityId]?.[date],
    normal: st.normals[cityId]?.[date.slice(5)],
    tempUnit: st.settings.tempUnit,
    windUnit: st.settings.windUnit,
    loadDay: st.loadDay,
  })));
  const { loadDay } = s;
  useEffect(() => { void loadDay(cityId, date); }, [cityId, date, loadDay]);

  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const W = (k?: number | null) => fmtWind(k, s.windUnit);
  if (!s.city) return <div className="screen"><ScreenHeader /><Text px={20}>This city is no longer followed.</Text></div>;

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
          {s.record && <Badge variant="white" color="dark" size="sm">{s.record.source === 'log' ? 'Logged' : 'Filled'}</Badge>}
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
              Low {T(d.temperature_2m_min ?? s.record?.lo)}° · feels {T(d.apparent_temperature_max ?? s.record?.feelsHi)}° / {T(d.apparent_temperature_min ?? s.record?.feelsLo)}°
              {delta && ` · ${delta} vs average`}
            </Text>
          </>
        )}
      </div>

      {!day && (
        <Box p={s.status?.error ? 20 : 0}>
          {s.status?.error ? (
            <>
              <Text fw={800}>Could not load this day</Text>
              <Text fz={13} c="dimmed">{s.status.error}</Text>
              <Button mt={12} variant="outline" color="gray" onClick={() => { useWeatherStore.setState((st) => ({ dayStatus: { ...st.dayStatus, [key]: { loading: false, error: null } } })); void loadDay(cityId, date); }}>Try again</Button>
            </>
          ) : (
            <>
              <Section title="Hour by hour"><ChartSk /></Section>
              <SectionSk title="Temperature" />
              <SectionSk title="Rain & snow" />
              <SectionSk title="Wind" n={2} />
              <SectionSk title="Sun" />
            </>
          )}
        </Box>
      )}

      {day && (
        <>
          <Section title="Hour by hour">
            <Box pt={12}><HourlyExplorer time={day.hourly.time} v={h} aqi={aqi} /></Box>
          </Section>

          <Section title="Temperature">
            <div className="stat-grid">
              <Stat k="High / low" v={`${T(d.temperature_2m_max)}° / ${T(d.temperature_2m_min)}°`} s={s.normal != null ? `Normal high ${T(s.normal)}°` : undefined} />
              <Stat k="Feels like" v={`${T(d.apparent_temperature_max)}° / ${T(d.apparent_temperature_min)}°`} />
              <Stat k="Humidity" v={`${f(avg(h.relative_humidity_2m))}%`} s="Daily average" />
              <Stat k="Dew point" v={`${T(avg(h.dew_point_2m))}°`} s="Daily average" />
            </div>
          </Section>

          <Section title="Rain & snow">
            <div className="stat-grid">
              <Stat k="Precipitation" v={`${f(d.precipitation_sum, 1)} mm`} s={`${f(d.precipitation_hours)} h wet`} />
              <Stat k="Rain" v={`${f(d.rain_sum, 1)} mm`} />
              <Stat k="Snowfall" v={`${f(d.snowfall_sum, 1)} cm`} s={(max(h.snow_depth) ?? 0) > 0 ? `Snow depth up to ${Math.round((max(h.snow_depth) ?? 0) * 100)} cm` : undefined} />
              {d.precipitation_probability_max != null && <Stat k="Forecast chance" v={`${f(d.precipitation_probability_max)}%`} />}
            </div>
          </Section>

          <Section title="Wind" summary={`Up to ${beaufort(d.wind_speed_10m_max ?? null).toLowerCase()}, mostly from the ${compass(d.wind_direction_10m_dominant ?? 0)}.`}>
            <div className="stat-grid">
              <Stat k="Max wind" v={W(d.wind_speed_10m_max)} />
              <Stat k="Max gusts" v={W(d.wind_gusts_10m_max)} s={beaufort(d.wind_gusts_10m_max ?? null)} />
            </div>
          </Section>

          <Section title="Sun">
            <div className="stat-grid">
              <Stat k="Sunrise" v={hhmm(day.daily.sunrise)} s={`Sunset ${hhmm(day.daily.sunset)}`} />
              <Stat k="Daylight" v={duration(d.daylight_duration ?? null)} s={`Sunshine ${duration(d.sunshine_duration ?? null)}`} />
              {d.uv_index_max != null && <Stat k="UV max" v={f(d.uv_index_max)} s={uvAdvice(d.uv_index_max)} />}
              <Stat k="Solar energy" v={`${f(d.shortwave_radiation_sum, 1)} MJ/m²`} />
            </div>
          </Section>

          <Section title="Sky & atmosphere">
            <div className="stat-grid">
              <Stat k="Cloud cover" v={`${f(avg(h.cloud_cover))}%`} s="Daily average" />
              <Stat k="Pressure" v={`${f(min(h.pressure_msl))}–${f(max(h.pressure_msl))}`} s="hPa, low–high" />
              <Stat k="Evaporation" v={`${f(d.et0_fao_evapotranspiration, 1)} mm`} s="ET₀" />
              {h.cape && <Stat k="Max CAPE" v={f(max(h.cape))} s="J/kg, thunderstorm energy" />}
            </div>
          </Section>

          {day.air && (
            <Section title="Air quality" summary={`Worst hour: ${f(aqiMax)} (${aqiLvl != null ? LEVELS[aqiLvl] : '–'}).`}>
              <div className="stat-grid">
                <Stat k="PM2.5 avg" v={`${f(avg(day.air.v.pm2_5))} µg/m³`} />
                <Stat k="PM10 avg" v={`${f(avg(day.air.v.pm10))} µg/m³`} />
                <Stat k="NO₂ avg" v={`${f(avg(day.air.v.nitrogen_dioxide))} µg/m³`} />
                <Stat k="Ozone max" v={`${f(max(day.air.v.ozone))} µg/m³`} />
              </div>
            </Section>
          )}

          <Text px={12} py={20} fz={11} c="dimmed">
            {day.source === 'forecast' ? 'Open-Meteo forecast models (past data)' : 'Open-Meteo historical weather (ERA5 reanalysis)'} · Weather data by Open-Meteo.com
          </Text>
        </>
      )}
    </div>
  );
}
