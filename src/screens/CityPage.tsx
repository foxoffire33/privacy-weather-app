import { Fragment, memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useSeriesToggle } from '../components/charts/SeriesToggle';
import { ActionIcon, Badge, Box, Button, Group, Paper, Text, UnstyledButton } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../store';
import type { City } from '../types';
import { conditionLabel } from '../lib/weatherCodes';
import { ago, compass, fmtDelta, fmtTemp, fmtWind, hhmm, hourOf, weekday } from '../lib/format';
import {
  LEVELS, beaufort, capeLabel, dewLabel, duration, euAqiLevel, feelsLabel, nowIndex, pollenLevel,
  pollutantLevel, pressureTrend, rainOutlook, signedMinutes, sunProgress, usAqiLabel, uvAdvice, visibilityLabel,
} from '../lib/insights';
import { Icon } from '../components/Icon';
import { Bar, Section, Stat, levelColor } from '../components/city/parts';
import { HourlyExplorer } from '../components/charts/HourlyExplorer';
import { CompositeChart } from '@mantine/charts';
import { addDays, convTemp } from '../lib/format';
import { ChartSk, CityBodySk, Sk } from '../components/Skeletons';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useDragScroll } from '../hooks/useDragScroll';
import { usePullPast } from '../hooks/usePullPast';

const WEEK_SERIES = [
  { name: 'mm', type: 'bar' as const, color: 'signal.7', yAxisId: 'right' },
  { name: 'High', type: 'line' as const, color: 'signal.4' },
  { name: 'Low', type: 'line' as const, color: 'signal.2' },
];

const POLLUTANTS = [
  { key: 'pm2_5', name: 'Fine particles', unit: 'PM2.5 · µg/m³' },
  { key: 'pm10', name: 'Coarse particles', unit: 'PM10 · µg/m³' },
  { key: 'nitrogen_dioxide', name: 'Nitrogen dioxide', unit: 'NO₂ · µg/m³' },
  { key: 'ozone', name: 'Ozone', unit: 'O₃ · µg/m³' },
  { key: 'sulphur_dioxide', name: 'Sulphur dioxide', unit: 'SO₂ · µg/m³' },
  { key: 'carbon_monoxide', name: 'Carbon monoxide', unit: 'CO · µg/m³' },
] as const;
const POLLEN = [
  ['alder_pollen', 'Alder'], ['birch_pollen', 'Birch'], ['grass_pollen', 'Grass'],
  ['mugwort_pollen', 'Mugwort'], ['olive_pollen', 'Olive'], ['ragweed_pollen', 'Ragweed'],
] as const;

export const CityPage = memo(function CityPage({ city, isDefault }: { city: City; isDefault: boolean }) {
  const { busy, refreshCity } = useWeatherStore(useShallow((st) => ({ busy: !!st.status[city.id]?.loading, refreshCity: st.refreshCity })));
  const { pull, armed, bind } = usePullToRefresh(() => void refreshCity(city.id, { maxAgeMs: 0 }));
  return (
    <div className="page" {...bind} style={{ position: 'relative' }}>
      <div aria-hidden style={{
        position: 'absolute', left: 0, right: 0, top: 64, display: 'flex', justifyContent: 'center',
        opacity: Math.min(1, pull / 40), color: armed ? 'var(--mantine-color-signal-5)' : '#fff', pointerEvents: 'none',
      }}>
        <span style={{ display: 'inline-flex', transform: `rotate(${pull * 4}deg)` }}><Icon name="refresh" size={20} /></span>
      </div>
      <div style={{ transform: `translateY(${pull}px)`, transition: pull ? 'none' : 'transform .25s ease' }}>
        <CityPageContent city={city} isDefault={isDefault} />
      </div>
      {busy && <span className="sr-only" role="status">Updating {city.name}</span>}
    </div>
  );
});

// Charts are the heavy part of a page: mount them just after the page itself so a slide never waits on them.
function Deferred({ h, children }: { h: number; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 250);
    return () => window.clearTimeout(t);
  }, []);
  return ready ? <>{children}</> : <ChartSk h={h} />;
}

function CityPageContent({ city, isDefault }: { city: City; isDefault: boolean }) {
  const weekTg = useSeriesToggle('week');
  const s = useWeatherStore(useShallow((st) => ({
    entry: st.forecasts[city.id],
    status: st.status[city.id],
    normals: st.normals[city.id],
    logged: Object.keys(st.history[city.id] ?? {}).length,
    expanded: st.expandedDay[city.id] ?? null,
    tempUnit: st.settings.tempUnit,
    windUnit: st.settings.windUnit,
    refreshCity: st.refreshCity,
    navigate: st.navigate,
    toggleDay: st.toggleDay,
    days: st.days,
    logYesterday: st.logYesterday,
    logDay: st.logDay,
    loadDay: st.loadDay,
  })));
  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const strip = useDragScroll<HTMLDivElement>();
  // Pulling right at the start of the strip reveals one earlier day per pull and adds it to the log.
  // Yesterday is already in the forecast response; older days are fetched (archive) first.
  const [back, setBack] = useState(0);
  const [loadingPast, setLoadingPast] = useState(false);
  const widthBefore = useRef(0);
  const loadPast = async () => {
    const el = strip.ref.current;
    const today = s.entry?.data.daily.time[s.entry.pastDays];
    if (!el || !today) return;
    const n = back + 1;
    if (n === 1) s.logYesterday(city.id);
    else {
      setLoadingPast(true);
      await s.loadDay(city.id, addDays(today, -n));
      setLoadingPast(false);
      if (!useWeatherStore.getState().days[`${city.id}:${addDays(today, -n)}`]) return;
      s.logDay(city.id, addDays(today, -n));
    }
    widthBefore.current = el.scrollWidth;
    setBack(n);
  };
  const pastPull = usePullPast(strip.ref, () => void loadPast(), !loadingPast);
  useLayoutEffect(() => {
    const el = strip.ref.current;
    if (!el || !back) return;
    const added = el.scrollWidth - widthBefore.current;
    el.scrollLeft = added; // keep what was on screen, then glide back to show the new hours
    el.scrollTo({ left: Math.max(0, added - 3 * 52), behavior: 'smooth' });
  }, [back]); // eslint-disable-line react-hooks/exhaustive-deps
  // Selecting a day scrolls the hourly strip to its first hour.
  useEffect(() => {
    const el = strip.ref.current;
    const first = s.expanded ? el?.querySelector<HTMLElement>(`[data-date="${s.expanded}"]`) : null;
    if (el && first) el.scrollTo({ left: (first.previousElementSibling as HTMLElement | null)?.classList.contains('day-divider') ? (first.previousElementSibling as HTMLElement).offsetLeft : first.offsetLeft, behavior: 'smooth' });
  }, [s.expanded]); // eslint-disable-line react-hooks/exhaustive-deps
  const W = (k?: number | null) => fmtWind(k, s.windUnit);
  const n0 = (v: number | null | undefined, digits = 0) => (v == null ? '–' : v.toFixed(digits));

  const title = (
    <Group gap={8}>
      <Text fz={15} fw={800}>{city.name}</Text>
      {isDefault && <Badge variant="white" color="dark" size="sm">Default</Badge>}
    </Group>
  );

  if (!s.entry) {
    return (
      <>
        <div className="hero">
          {title}
          {s.status?.error ? (
            <>
              <div className="hero-temp">–°</div>
              <Text fz={18} fw={800} mt={12}>Could not load the forecast</Text>
              <Text fz={13} fw={600}>{s.status.error}</Text>
              <Button mt={16} onClick={() => s.refreshCity(city.id, { maxAgeMs: 0 })}>Try again</Button>
            </>
          ) : (
            <>
              <Sk w={200} h={143} mt={8} />
              <Sk w={180} h={22} mt={14} />
              <Sk w={260} h={14} mt={8} />
            </>
          )}
        </div>
        {!s.status?.error && <CityBodySk />}
      </>
    );
  }

  const { data, air, marine, pastDays: t, fetchedAt } = s.entry;
  const c = data.current.v;
  const hv = data.hourly.v;
  const dv = data.daily.v;
  const today = data.daily.time[t];
  const h0 = nowIndex(data);
  const normal = s.normals?.[today.slice(5)];
  const delta = normal != null && dv.temperature_2m_max[t] != null ? dv.temperature_2m_max[t]! - normal : null;
  const precipProb = dv.precipitation_probability_max[t] ?? 0;

  // Hourly strip: every remaining hour of the 7-day forecast
  type Cell = { time: string; date: string; isNow: boolean; past: boolean; temp: number | null | undefined; p: number | null; wind: number | null | undefined };
  const cells: Cell[] = [];
  // Days before yesterday (fetched on pull), oldest first.
  for (let n = back; n >= 2; n--) {
    const day = s.days[`${city.id}:${addDays(today, -n)}`];
    if (!day) continue;
    day.hourly.time.forEach((time, k) => cells.push({
      time, date: time.slice(0, 10), isNow: false, past: true,
      temp: day.hourly.v.temperature_2m?.[k], p: day.hourly.v.precipitation_probability?.[k] ?? null, wind: day.hourly.v.wind_speed_10m?.[k],
    }));
  }
  const from = back >= 1 ? 0 : h0; // yesterday and today's passed hours are part of the forecast response
  data.hourly.time.slice(from).forEach((time, k) => {
    const i = from + k;
    cells.push({
      time, date: time.slice(0, 10), isNow: i === h0, past: i < h0,
      temp: i === h0 ? c.temperature_2m : hv.temperature_2m[i], p: hv.precipitation_probability[i] ?? 0, wind: hv.wind_speed_10m[i],
    });
  });
  const hours = cells.map((h, k) => {
    const dayStart = hourOf(h.time) === '00' && k > 0;
    return {
      ...h,
      label: h.isNow ? 'Now' : hourOf(h.time) === '00' ? weekday(h.date) : hourOf(h.time),
      dayBreak: dayStart,
      dayName: dayStart ? weekday(h.date).toUpperCase() : '',
    };
  });

  // 2-hour nowcast (15-minute steps)
  const mq = data.minutely15;
  const mMax = Math.max(0.5, ...(mq?.precipitation.map((v) => v ?? 0) ?? [0]));

  const days = data.daily.time.slice(t, t + 7).map((date, k) => ({ date, i: t + k, label: k === 0 ? 'Today' : weekday(date) }));

  // Sun
  const daylightChange = dv.daylight_duration[t] != null && dv.daylight_duration[t - 1] != null
    ? dv.daylight_duration[t]! - dv.daylight_duration[t - 1]! : null;
  const sunPos = sunProgress(data.current.time, data.daily.sunrise[t], data.daily.sunset[t]);

  // Air
  const aqi = air?.current.european_aqi ?? null;
  const aqiLvl = euAqiLevel(aqi);
  const aqiAhead = air ? air.hourly.time.reduce<{ v: number; time: string } | null>((worst, time, i) => {
    const v = air.hourly.aqi[i];
    if (time < data.hourly.time[h0] || v == null || time > data.hourly.time[h0 + 24]) return worst;
    return !worst || v > worst.v ? { v, time } : worst;
  }, null) : null;
  const pollen = air ? POLLEN.map(([k, name]) => ({ name, v: air.current[k], lvl: pollenLevel(air.current[k]) })).filter((p) => p.v != null) : [];

  const trend = pressureTrend(data, h0);
  const windChill = c.apparent_temperature != null && c.temperature_2m != null ? c.apparent_temperature - c.temperature_2m : 0;

  return (
    <>
      <div className="hero">
        {title}
        <div className="hero-temp">{T(c.temperature_2m)}°</div>
        <Text fz={20} fw={800} mt={8}>{conditionLabel(c.weather_code)}, {precipProb}%</Text>
        <Text fz={13} fw={600}>
          Feels like {T(c.apparent_temperature)}° · H {T(dv.temperature_2m_max[t])}° L {T(dv.temperature_2m_min[t])}°
          {delta != null && ` · ${fmtDelta(delta, s.tempUnit)} vs average`}
        </Text>
      </div>

      <Paper className="glass" mx={12} mt={-36} pos="relative">
        <Box px={12} pt={12} pb={10} style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <Text fz={14} fw={800}>{rainOutlook(data, h0)}</Text>
          {mq && (
            <>
              <div className="nowcast" style={{ marginTop: 8 }}>
                {mq.precipitation.map((v, i) => (
                  <div key={mq.time[i]} style={{ height: `${Math.max(6, ((v ?? 0) / mMax) * 100)}%`, background: (v ?? 0) >= 0.1 ? 'var(--mantine-color-signal-4)' : 'rgba(255,255,255,.12)' }} />
                ))}
              </div>
              <Group justify="space-between" mt={4}>
                <Text fz={12} c="dimmed">{hhmm(mq.time[0])}</Text>
                <Text fz={12} c="dimmed">next 2 hours · mm per 15 min</Text>
                <Text fz={12} c="dimmed">{hhmm(mq.time[mq.time.length - 1])}</Text>
              </Group>
            </>
          )}
        </Box>

        <div className="hourly-strip" {...strip} {...pastPull.touch}>
          {pastPull.pull > 0 && (
            <div className="pull-past" style={{ width: pastPull.pull, color: pastPull.armed ? 'var(--mantine-color-signal-4)' : undefined }}>
              {loadingPast ? '…' : pastPull.armed ? 'Release' : back ? 'Earlier' : 'Yesterday'}
            </div>
          )}
          {hours.map((h) => (
            <Fragment key={h.time}>
            {h.dayName && (
              <div className="day-divider" data-on={h.date === s.expanded || undefined} aria-label={h.dayName}>
                <i />
                {[...h.dayName].map((ch, n) => <span key={n}>{ch}</span>)}
                <i />
              </div>
            )}
            <Box data-date={h.dayBreak || h.date === hours[0].date && h.time === hours[0].time ? h.date : undefined} data-now={h.isNow || undefined} data-on={h.date === s.expanded || undefined} style={h.past ? { opacity: .55 } : undefined}>
              <Text fz={12} c="dimmed" fw={h.dayBreak ? 800 : 400}>{h.label}</Text>
              <Text fz={16} fw={800}>{T(h.temp)}°</Text>
              <Text fz={12} fw={600} c="signal.3">{h.p == null ? '–' : `${h.p}%`}</Text>
              <Text fz={12} c="dimmed">{h.wind == null ? '–' : Math.round(h.wind)}</Text>
            </Box>
            </Fragment>
          ))}
        </div>
        <UnstyledButton w="100%" px={12} py={10} onClick={() => s.navigate({ name: 'hourly', cityId: city.id })}
          style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(248,244,244,.2)' }}>
          <Text fz={13} fw={800}>Hourly forecast · 7 days</Text>
          <Icon name="arrow" size={16} />
        </UnstyledButton>

        {days.map(({ date, i, label }) => {
          const open = s.expanded === date;
          return (
            <Box key={date} className="row" data-on={open || undefined}>
              <UnstyledButton w="100%" px={12} py={9} onClick={() => s.toggleDay(city.id, date)}
                style={{ display: 'grid', gridTemplateColumns: '52px 1fr 44px 40px 32px', alignItems: 'center', gap: 4 }}>
                <Text fz={14} fw={800}>{label}</Text>
                <Text fz={12} c="dimmed" truncate>{conditionLabel(dv.weather_code[i])}</Text>
                <Text fz={12} fw={600} c="signal.3">{dv.precipitation_probability_max[i] ?? 0}%</Text>
                <Text fz={14} fw={800}>{T(dv.temperature_2m_max[i])}°</Text>
                <Text fz={14} c="dimmed">{T(dv.temperature_2m_min[i])}°</Text>
              </UnstyledButton>
              {open && (
                <Box className="stat-grid" px={12} pb={8}>
                  <Stat k="Feels like" v={`${T(dv.apparent_temperature_max[i])}° / ${T(dv.apparent_temperature_min[i])}°`} />
                  <Stat k="Precipitation" v={`${n0(dv.precipitation_sum[i], 1)} mm`} s={`${n0(dv.precipitation_hours[i])} h · rain ${n0(dv.rain_sum[i], 1)} · showers ${n0(dv.showers_sum[i], 1)}`} />
                  <Stat k="Snowfall" v={`${n0(dv.snowfall_sum[i], 1)} cm`} />
                  <Stat k="Wind" v={W(dv.wind_speed_10m_max[i])} s={`Gusts ${W(dv.wind_gusts_10m_max[i])} · from ${compass(dv.wind_direction_10m_dominant[i] ?? 0)}`} />
                  <Stat k="UV max" v={n0(dv.uv_index_max[i])} s={uvAdvice(dv.uv_index_max[i])} />
                  <Stat k="Sunshine" v={duration(dv.sunshine_duration[i])} s={`of ${duration(dv.daylight_duration[i])} daylight`} />
                  <Stat k="Sunrise" v={hhmm(data.daily.sunrise[i])} s={`Sunset ${hhmm(data.daily.sunset[i])}`} />
                  <Stat k="Solar energy" v={`${n0(dv.shortwave_radiation_sum[i], 1)} MJ/m²`} />
                </Box>
              )}
            </Box>
          );
        })}
      </Paper>

      <Section title="Next 48 hours">
        <Box pt={12}><Deferred h={270}>
          <HourlyExplorer time={data.hourly.time} v={hv} from={h0} to={h0 + 48}
            aqi={air ? Object.fromEntries(air.hourly.time.map((tm, i) => [tm, air.hourly.aqi[i]])) : undefined} />
        </Deferred></Box>
      </Section>

      <Section title="Next 7 days">
        <Box pt={12}><Deferred h={230}>
          <CompositeChart h={200} dataKey="label"
            yAxisProps={{ width: 36, domain: [(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)], allowDecimals: false }} withRightYAxis rightYAxisProps={{ width: 32 }}
            data={days.map(({ i, label }) => ({
              label,
              High: convTemp(dv.temperature_2m_max[i], s.tempUnit),
              Low: convTemp(dv.temperature_2m_min[i], s.tempUnit),
              mm: dv.precipitation_sum[i],
            }))}
            withLegend={false} series={weekTg.visible(WEEK_SERIES)} />
          {weekTg.legend(WEEK_SERIES)}
        </Deferred></Box>
      </Section>

      <Section title="Feels like" summary={`${feelsLabel(c.apparent_temperature)}. ${Math.abs(windChill) >= 1 ? `Feels ${Math.abs(Math.round(windChill))}° ${windChill < 0 ? 'colder' : 'warmer'} than the air temperature${windChill < 0 ? ' because of wind and humidity' : ''}.` : 'Close to the air temperature.'}`}>
        <div className="stat-grid">
          <Stat k="Feels like" v={`${T(c.apparent_temperature)}°`} s={`Air ${T(c.temperature_2m)}°`} />
          <Stat k="Humidity" v={`${n0(c.relative_humidity_2m)}%`} s={dewLabel(c.dew_point_2m)} />
          <Stat k="Dew point" v={`${T(c.dew_point_2m)}°`} />
          <Stat k="Today feels" v={`${T(dv.apparent_temperature_max[t])}° / ${T(dv.apparent_temperature_min[t])}°`} s="Max / min" />
        </div>
      </Section>

      <Section title="Sun" summary={daylightChange != null ? `${duration(dv.daylight_duration[t])} of daylight, ${signedMinutes(daylightChange)} compared with yesterday.` : undefined}>
        <Box py={12} className="row">
          <Group justify="space-between" mb={6}>
            <Text fz={20} fw={800}>{hhmm(data.daily.sunrise[t])}</Text>
            <Text fz={20} fw={800}>{hhmm(data.daily.sunset[t])}</Text>
          </Group>
          <div className="bar" style={{ height: 6 }}>
            <div style={{ width: `${(sunPos ?? (c.is_day ? 1 : 0)) * 100}%`, background: 'var(--mantine-color-signal-4)' }} />
          </div>
          <Group justify="space-between" mt={4}>
            <Text fz={12} c="dimmed">Sunrise</Text>
            <Text fz={12} c="dimmed">{sunPos == null ? 'Sun is down' : `${Math.round(sunPos * 100)}% of daylight passed`}</Text>
            <Text fz={12} c="dimmed">Sunset</Text>
          </Group>
        </Box>
        <div className="stat-grid">
          <Stat k="UV now" v={n0(c.uv_index)} s={uvAdvice(c.uv_index)} />
          <Stat k="UV max today" v={n0(dv.uv_index_max[t])} s={`Clear sky max ${n0(dv.uv_index_clear_sky_max[t])}`} />
          <Stat k="Sunshine today" v={duration(dv.sunshine_duration[t])} />
          <Stat k="Tomorrow" v={hhmm(data.daily.sunrise[t + 1])} s={`Sunset ${hhmm(data.daily.sunset[t + 1])}`} />
        </div>
      </Section>

      <Section title="Rain & snow">
        <div className="stat-grid">
          <Stat k="Now" v={`${n0(c.precipitation, 1)} mm`} s={`Rain ${n0(c.rain, 1)} · showers ${n0(c.showers, 1)} · snow ${n0(c.snowfall, 1)} cm`} />
          <Stat k="Today" v={`${n0(dv.precipitation_sum[t], 1)} mm`} s={`${n0(dv.precipitation_hours[t])} h wet · ${precipProb}% chance`} />
          <Stat k="Snowfall today" v={`${n0(dv.snowfall_sum[t], 1)} cm`} s={(hv.snow_depth[h0] ?? 0) > 0 ? `Snow on ground ${Math.round((hv.snow_depth[h0] ?? 0) * 100)} cm` : 'No snow on the ground'} />
          <Stat k="Tomorrow" v={`${n0(dv.precipitation_sum[t + 1], 1)} mm`} s={`${dv.precipitation_probability_max[t + 1] ?? 0}% chance`} />
        </div>
      </Section>

      <Section title="Wind" summary={`${beaufort(c.wind_speed_10m)} from the ${compass(c.wind_direction_10m ?? 0)}.`}>
        <div className="stat-grid">
          <Stat k="Wind" v={W(c.wind_speed_10m)} s={
            <Group gap={4} component="span">
              <span style={{ display: 'inline-flex', transform: `rotate(${(c.wind_direction_10m ?? 0) + 180}deg)` }}><Icon name="arrowUp" size={12} /></span>
              from {compass(c.wind_direction_10m ?? 0)} · {n0(c.wind_direction_10m)}°
            </Group>
          } />
          <Stat k="Gusts" v={W(c.wind_gusts_10m)} s={beaufort(c.wind_gusts_10m)} />
          <Stat k="Max today" v={W(dv.wind_speed_10m_max[t])} s={`Gusts up to ${W(dv.wind_gusts_10m_max[t])}`} />
          <Stat k="Tomorrow" v={W(dv.wind_speed_10m_max[t + 1])} s={`Gusts up to ${W(dv.wind_gusts_10m_max[t + 1])}`} />
        </div>
      </Section>

      <Section title="Air quality" summary={air ? `${aqiLvl != null ? LEVELS[aqiLvl] : 'Unknown'} air right now.${aqiAhead ? ` Worst in the next 24 h: ${Math.round(aqiAhead.v)} at ${hhmm(aqiAhead.time)}.` : ''}` : 'Air quality data is not available for this place.'}>
        {air && (
          <>
            <div className="stat-grid">
              <Stat k="European AQI" v={n0(aqi)} s={aqiLvl != null ? LEVELS[aqiLvl] : '–'}>
                <Bar pct={((aqi ?? 0) / 120) * 100} level={aqiLvl} />
              </Stat>
              <Stat k="US AQI" v={n0(air.current.us_aqi)} s={usAqiLabel(air.current.us_aqi)}>
                <Bar pct={((air.current.us_aqi ?? 0) / 300) * 100} color="var(--mantine-color-dark-1)" />
              </Stat>
            </div>
            {POLLUTANTS.map((p) => {
              const v = air.current[p.key];
              const lvl = pollutantLevel(p.key, v);
              return (
                <Box key={p.key} py={8} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 64px 84px', gap: 8, alignItems: 'center' }}>
                  <Box><Text fz={13} fw={600}>{p.name}</Text><Text fz={12} c="dimmed">{p.unit}</Text></Box>
                  <Text fz={15} fw={800}>{n0(v)}</Text>
                  <Box><Text fz={12} c="dimmed">{lvl != null ? LEVELS[lvl] : '—'}</Text>{lvl != null && <Bar pct={((lvl + 1) / 6) * 100} level={lvl} />}</Box>
                </Box>
              );
            })}
            <div className="stat-grid">
              <Stat k="Dust" v={`${n0(air.current.dust)} µg/m³`} s="Saharan / desert dust" />
              <Stat k="Haze" v={n0(air.current.aerosol_optical_depth, 2)} s="Aerosol optical depth" />
            </div>
          </>
        )}
      </Section>

      {pollen.length > 0 && (
        <Section title="Pollen" summary={pollen.some((p) => (p.v ?? 0) >= 0.5)
          ? 'Grains per m³. Forecast covers Europe during the season.'
          : 'No pollen in the air right now.'}>
          {pollen.some((p) => (p.v ?? 0) >= 0.5) && pollen.map((p) => (
            <Box key={p.name} py={8} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 56px 96px', gap: 8, alignItems: 'center' }}>
              <Text fz={13} fw={600}>{p.name}</Text>
              <Text fz={15} fw={800}>{n0(p.v)}</Text>
              <Box><Text fz={12} c="dimmed">{p.lvl?.label}</Text><Bar pct={(((p.lvl?.level ?? 0) + 1) / 5) * 100} color={levelColor(p.lvl ? p.lvl.level : null)} /></Box>
            </Box>
          ))}
        </Section>
      )}

      <Section title="Sky">
        <div className="stat-grid">
          <Stat k="Cloud cover" v={`${n0(c.cloud_cover)}%`}><Bar pct={c.cloud_cover ?? 0} color="var(--mantine-color-dark-1)" /></Stat>
          <Stat k="Visibility" v={c.visibility == null ? '–' : `${(c.visibility / 1000).toFixed(c.visibility < 10000 ? 1 : 0)} km`} s={visibilityLabel(c.visibility)} />
          <Stat k="Low clouds" v={`${n0(hv.cloud_cover_low[h0])}%`} s="Below 3 km"><Bar pct={hv.cloud_cover_low[h0] ?? 0} color="var(--mantine-color-dark-2)" /></Stat>
          <Stat k="Mid / high" v={`${n0(hv.cloud_cover_mid[h0])}% / ${n0(hv.cloud_cover_high[h0])}%`} s="3–8 km / above 8 km" />
        </div>
      </Section>

      <Section title="Atmosphere">
        <div className="stat-grid">
          <Stat k="Pressure" v={`${n0(c.pressure_msl)} hPa`} s={trend ? `${trend.label} · ${trend.delta >= 0 ? '+' : '−'}${Math.abs(trend.delta).toFixed(1)} in 3 h` : 'Sea level'} />
          <Stat k="Thunderstorm risk" v={capeLabel(hv.cape[h0])} s={`CAPE ${n0(hv.cape[h0])} J/kg`} />
          <Stat k="Freezing level" v={hv.freezing_level_height[h0] == null ? '–' : `${Math.round(hv.freezing_level_height[h0]!)} m`} s="Height of 0 °C" />
          <Stat k="Evaporation" v={`${n0(dv.et0_fao_evapotranspiration[t], 1)} mm`} s="Plants lose today (ET₀)" />
        </div>
      </Section>

      {marine && (
        <Section title="Sea">
          <div className="stat-grid">
            <Stat k="Waves" v={marine.current.wave_height == null ? '–' : `${marine.current.wave_height.toFixed(1)} m`} s={`From ${compass(marine.current.wave_direction ?? 0)} · every ${n0(marine.current.wave_period)} s`} />
            <Stat k="Swell" v={marine.current.swell_wave_height == null ? '–' : `${marine.current.swell_wave_height.toFixed(1)} m`} />
            <Stat k="Sea temperature" v={`${T(marine.current.sea_surface_temperature)}°`} />
          </div>
        </Section>
      )}

      <Box mx={12} mt={24}>
        <Button className="glass" variant="default" size="lg" fullWidth
          rightSection={<Icon name="arrow" size={18} />} onClick={() => s.navigate({ name: 'history', cityId: city.id })}>
          History · {s.logged} {s.logged === 1 ? 'day' : 'days'} logged
        </Button>
      </Box>

      <Group justify="space-between" px={12} pt={12} pb={24} wrap="nowrap" align="flex-start">
        <Box>
          <Text fz={12} c="dimmed">{city.lat.toFixed(2)}°, {city.lon.toFixed(2)}° · {Math.round(data.elevation)} m · {data.timezone}</Text>
          <Text fz={12} c="dimmed">Weather data by Open-Meteo.com · updated {ago(fetchedAt)}</Text>
        </Box>
        <ActionIcon size={36} aria-label={s.status?.loading ? 'Updating' : 'Refresh'} aria-busy={s.status?.loading || undefined}
          onClick={() => s.refreshCity(city.id, { maxAgeMs: 0 })}>
          <span className={s.status?.loading ? 'spin' : undefined}><Icon name="refresh" size={16} /></span>
        </ActionIcon>
      </Group>
    </>
  );
}
