import { Fragment, memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useSeriesToggle } from '../components/charts/SeriesToggle';
import { ActionIcon, Badge, Box, Button, Group, Paper, Text, UnstyledButton, VisuallyHidden } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import {
  openDay, refreshCity, useDayStore, useForecast, useForecastQuery, useLogCount, useNormals, useUnits,
} from '../stores';
import { useUiStore } from '../stores/uiStore';
import type { City } from '../stores';
import { conditionLabel } from '../lib/weatherCodes';
import { ago, compass, fmtDelta, fmtTemp, fmtWind, hhmm, hourOf, weekday } from '../lib/format';
import {
  levelName, beaufort, capeLabel, dewLabel, duration, euAqiLevel, feelsLabel, nowIndex, pollenLevel,
  pollutantLevel, pressureTrend, rainOutlook, signedMinutes, sunProgress, usAqiLabel, uvAdvice, visibilityLabel,
} from '../lib/insights';
import { Icon } from '../components/Icon';
import { Bar, Section, Stat, levelColor } from '../components/city/parts';
import { HourlyExplorer } from '../components/charts/HourlyExplorer';
import { CompositeChart } from '@mantine/charts';
import { convTemp } from '../lib/format';
import { addDays } from '../stores';
import { ChartSk, CityBodySk, Sk } from '../components/Skeletons';
import { useDragScroll } from '../hooks/useDragScroll';
import { usePullPast } from '../hooks/usePullPast';
import { t as tx, type MessageKey } from '../i18n';

const weekSeries = () => [
  { name: 'mm', label: tx('chart.mm'), type: 'bar' as const, color: 'signal.7', yAxisId: 'right' },
  { name: 'High', label: tx('city.high'), type: 'line' as const, color: 'signal.4' },
  { name: 'Low', label: tx('city.low'), type: 'line' as const, color: 'signal.2' },
];

const POLLUTANTS = [
  { key: 'pm2_5', unit: 'PM2.5 · µg/m³' },
  { key: 'pm10', unit: 'PM10 · µg/m³' },
  { key: 'nitrogen_dioxide', unit: 'NO₂ · µg/m³' },
  { key: 'ozone', unit: 'O₃ · µg/m³' },
  { key: 'sulphur_dioxide', unit: 'SO₂ · µg/m³' },
  { key: 'carbon_monoxide', unit: 'CO · µg/m³' },
] as const;
const POLLEN = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'] as const;

export const CityPage = memo(function CityPage({ city, isDefault }: { city: City; isDefault: boolean }) {
  const busy = useForecastQuery(city.id).status === 'loading';
  return (
    <Box className="page">
      <CityPageContent city={city} isDefault={isDefault} />
      {busy && <VisuallyHidden role="status">{tx('city.updatingCity', { name: city.name })}</VisuallyHidden>}
    </Box>
  );
});

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
  const entry = useForecast(city.id);
  const query = useForecastQuery(city.id);
  const units = useUnits();
  const s = {
    entry,
    error: query.error,
    loading: query.status === 'loading',
    normals: useNormals(city.id),
    logged: useLogCount(city.id),
    expanded: useUiStore((st) => st.expandedDay[city.id] ?? null),
    tempUnit: units.temp,
    windUnit: units.wind,
    days: useDayStore((st) => st.days),
    ...useUiStore(useShallow((st) => ({ navigate: st.navigate, toggleDay: st.toggleDay }))),
  };
  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const strip = useDragScroll<HTMLDivElement>();
  const [back, setBack] = useState(0);
  const [loadingPast, setLoadingPast] = useState(false);
  const widthBefore = useRef(0);
  const loadPast = async () => {
    const el = strip.ref.current;
    const today = s.entry?.data.daily.time[s.entry.pastDays];
    if (!el || !today) return;
    const n = back + 1;
    if (n > 1) {
      const date = addDays(today, -n);
      setLoadingPast(true);
      await openDay(city.id, date);
      setLoadingPast(false);
      if (!useDayStore.getState().days[`${city.id}:${date}`]) return;
    }
    widthBefore.current = el.scrollWidth;
    setBack(n);
  };
  const pastPull = usePullPast(strip.ref, () => void loadPast(), !loadingPast);
  useLayoutEffect(() => {
    const el = strip.ref.current;
    if (!el || !back) return;
    const added = el.scrollWidth - widthBefore.current;
    el.scrollLeft = added;
    el.scrollTo({ left: Math.max(0, added - 3 * 52), behavior: 'smooth' });
  }, [back]);
  useEffect(() => {
    const el = strip.ref.current;
    const first = s.expanded ? el?.querySelector<HTMLElement>(`[data-date="${s.expanded}"]`) : null;
    if (el && first) el.scrollTo({ left: (first.previousElementSibling as HTMLElement | null)?.classList.contains('day-divider') ? (first.previousElementSibling as HTMLElement).offsetLeft : first.offsetLeft, behavior: 'smooth' });
  }, [s.expanded]);
  const W = (k?: number | null) => fmtWind(k, s.windUnit);
  const n0 = (v: number | null | undefined, digits = 0) => (v == null ? '–' : v.toFixed(digits));
  const title = (
    <Group gap={8}>
      <Text fz={15} fw={800}>{city.name}</Text>
      {isDefault && <Badge variant="white" color="dark" size="sm">{tx('common.default')}</Badge>}
    </Group>
  );
  if (!s.entry) {
    return (
      <>
        <div className="hero">
          {title}
          {s.error ? (
            <>
              <div className="hero-temp">–°</div>
              <Text fz={18} fw={800} mt={12}>{tx('city.couldNotLoad')}</Text>
              <Text fz={13} fw={600}>{s.error}</Text>
              <Button mt={16} onClick={() => void refreshCity(city.id, { maxAgeMs: 0 })}>{tx('common.tryAgain')}</Button>
            </>
          ) : (
            <>
              <Sk w={200} h={143} mt={8} />
              <Sk w={180} h={22} mt={14} />
              <Sk w={260} h={14} mt={8} />
            </>
          )}
        </div>
        {!s.error && <CityBodySk />}
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
  type Cell = { time: string; date: string; isNow: boolean; past: boolean; temp: number | null | undefined; p: number | null; wind: number | null | undefined };
  const cells: Cell[] = [];
  for (let n = back; n >= 2; n--) {
    const day = s.days[`${city.id}:${addDays(today, -n)}`];
    if (!day) continue;
    day.hourly.time.forEach((time, k) => cells.push({
      time, date: time.slice(0, 10), isNow: false, past: true,
      temp: day.hourly.v.temperature_2m?.[k], p: day.hourly.v.precipitation_probability?.[k] ?? null, wind: day.hourly.v.wind_speed_10m?.[k],
    }));
  }
  const from = back >= 1 ? 0 : h0;
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
      label: h.isNow ? tx('common.now') : hourOf(h.time) === '00' ? weekday(h.date) : hourOf(h.time),
      dayBreak: dayStart,
      dayName: dayStart ? weekday(h.date).toLocaleUpperCase() : '',
    };
  });
  const mq = data.minutely15;
  const mMax = Math.max(0.5, ...(mq?.precipitation.map((v) => v ?? 0) ?? [0]));
  const days = data.daily.time.slice(t, t + 7).map((date, k) => ({ date, i: t + k, label: k === 0 ? tx('common.today') : weekday(date) }));
  const daylightChange = dv.daylight_duration[t] != null && dv.daylight_duration[t - 1] != null
    ? dv.daylight_duration[t]! - dv.daylight_duration[t - 1]! : null;
  const sunPos = sunProgress(data.current.time, data.daily.sunrise[t], data.daily.sunset[t]);
  const aqi = air?.current.european_aqi ?? null;
  const aqiLvl = euAqiLevel(aqi);
  const aqiAhead = air ? air.hourly.time.reduce<{ v: number; time: string } | null>((worst, time, i) => {
    const v = air.hourly.aqi[i];
    if (time < data.hourly.time[h0] || v == null || time > data.hourly.time[h0 + 24]) return worst;
    return !worst || v > worst.v ? { v, time } : worst;
  }, null) : null;
  const pollen = air ? POLLEN.map((k) => ({ name: tx(`city.pollen.${k}`), v: air.current[k], lvl: pollenLevel(air.current[k]) })).filter((p) => p.v != null) : [];
  const trend = pressureTrend(data, h0);
  const windChill = c.apparent_temperature != null && c.temperature_2m != null ? c.apparent_temperature - c.temperature_2m : 0;
  return (
    <>
      <div className="hero">
        {title}
        <div className="hero-temp">{T(c.temperature_2m)}°</div>
        <Text fz={20} fw={800} mt={8}>{tx('city.precipChance', { cond: conditionLabel(c.weather_code), p: precipProb })}</Text>
        <Text fz={13} fw={600}>
          {tx('city.heroLine', { feels: T(c.apparent_temperature), hi: T(dv.temperature_2m_max[t]), lo: T(dv.temperature_2m_min[t]) })}
          {delta != null && ` · ${tx('city.vsAverage', { delta: fmtDelta(delta, s.tempUnit) })}`}
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
                <Text fz={12} c="dimmed">{tx('city.nowcastCaption')}</Text>
                <Text fz={12} c="dimmed">{hhmm(mq.time[mq.time.length - 1])}</Text>
              </Group>
            </>
          )}
        </Box>

        <div className="hourly-strip" {...strip} {...pastPull.touch}>
          <div ref={pastPull.indicatorRef} className="pull-past" data-armed={pastPull.armed || undefined}>
            {loadingPast ? '…' : pastPull.armed ? tx('city.release') : back ? tx('city.earlier') : tx('city.yesterday')}
          </div>
          {hours.map((h) => (
            <Fragment key={h.time}>
            {h.dayName && (
              <div className="day-divider" data-on={h.date === s.expanded || undefined} aria-label={h.dayName}>
                <i />
                {[...h.dayName].map((ch, n) => <span key={n}>{ch}</span>)}
                <i />
              </div>
            )}
            <Box data-date={h.dayBreak || h.date === hours[0].date && h.time === hours[0].time ? h.date : undefined} data-now={h.isNow || undefined} data-on={h.date === s.expanded || undefined} style={h.past ? { opacity: .82 } : undefined}>
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
          <Text fz={13} fw={800}>{tx('city.hourlyLink')}</Text>
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
                  <Stat k={tx('city.day.feelsLike')} v={`${T(dv.apparent_temperature_max[i])}° / ${T(dv.apparent_temperature_min[i])}°`} />
                  <Stat k={tx('city.day.precipitation')} v={`${n0(dv.precipitation_sum[i], 1)} mm`} s={tx('city.day.precipDetail', { h: n0(dv.precipitation_hours[i]), rain: n0(dv.rain_sum[i], 1), showers: n0(dv.showers_sum[i], 1) })} />
                  <Stat k={tx('city.day.snowfall')} v={`${n0(dv.snowfall_sum[i], 1)} cm`} />
                  <Stat k={tx('city.day.wind')} v={W(dv.wind_speed_10m_max[i])} s={tx('city.day.windDetail', { gusts: W(dv.wind_gusts_10m_max[i]), dir: compass(dv.wind_direction_10m_dominant[i] ?? 0) })} />
                  <Stat k={tx('city.day.uvMax')} v={n0(dv.uv_index_max[i])} s={uvAdvice(dv.uv_index_max[i])} />
                  <Stat k={tx('city.day.sunshine')} v={duration(dv.sunshine_duration[i])} s={tx('city.day.ofDaylight', { d: duration(dv.daylight_duration[i]) })} />
                  <Stat k={tx('city.day.sunrise')} v={hhmm(data.daily.sunrise[i])} s={tx('city.sun.sunsetAt', { time: hhmm(data.daily.sunset[i]) })} />
                  <Stat k={tx('city.day.solarEnergy')} v={`${n0(dv.shortwave_radiation_sum[i], 1)} MJ/m²`} />
                </Box>
              )}
            </Box>
          );
        })}
      </Paper>

      <Section title={tx('city.next48')}>
        <Box pt={12}><Deferred h={270}>
          <HourlyExplorer time={data.hourly.time} v={hv} from={h0} to={h0 + 48}
            aqi={air ? Object.fromEntries(air.hourly.time.map((tm, i) => [tm, air.hourly.aqi[i]])) : undefined} />
        </Deferred></Box>
      </Section>

      <Section title={tx('city.next7')}>
        <Box pt={12}><Deferred h={230}>
          <CompositeChart h={200} dataKey="label"
            yAxisProps={{ width: 36, domain: [(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)], allowDecimals: false }} withRightYAxis rightYAxisProps={{ width: 32 }}
            data={days.map(({ i, label }) => ({
              label,
              High: convTemp(dv.temperature_2m_max[i], s.tempUnit),
              Low: convTemp(dv.temperature_2m_min[i], s.tempUnit),
              mm: dv.precipitation_sum[i],
            }))}
            withLegend={false} series={weekTg.visible(weekSeries())} />
          {weekTg.legend(weekSeries())}
        </Deferred></Box>
      </Section>

      <Section title={tx('city.feels.title')} summary={tx(Math.abs(windChill) < 1 ? 'city.feels.close' : windChill < 0 ? 'city.feels.colder' : 'city.feels.warmer', { label: feelsLabel(c.apparent_temperature), n: Math.abs(Math.round(windChill)) })}>
        <div className="stat-grid">
          <Stat k={tx('city.feels.title')} v={`${T(c.apparent_temperature)}°`} s={tx('city.feels.air', { t: T(c.temperature_2m) })} />
          <Stat k={tx('city.feels.humidity')} v={`${n0(c.relative_humidity_2m)}%`} s={dewLabel(c.dew_point_2m)} />
          <Stat k={tx('city.feels.dewPoint')} v={`${T(c.dew_point_2m)}°`} />
          <Stat k={tx('city.feels.todayFeels')} v={`${T(dv.apparent_temperature_max[t])}° / ${T(dv.apparent_temperature_min[t])}°`} s={tx('city.feels.maxMin')} />
        </div>
      </Section>

      <Section title={tx('city.sun.title')} summary={daylightChange != null ? tx('city.sun.summary', { daylight: duration(dv.daylight_duration[t]), change: signedMinutes(daylightChange) }) : undefined}>
        <Box py={12} className="row">
          <Group justify="space-between" mb={6}>
            <Text fz={20} fw={800}>{hhmm(data.daily.sunrise[t])}</Text>
            <Text fz={20} fw={800}>{hhmm(data.daily.sunset[t])}</Text>
          </Group>
          <div className="bar" style={{ height: 6 }}>
            <div style={{ width: `${(sunPos ?? (c.is_day ? 1 : 0)) * 100}%`, background: 'var(--mantine-color-signal-4)' }} />
          </div>
          <Group justify="space-between" mt={4}>
            <Text fz={12} c="dimmed">{tx('city.sun.sunrise')}</Text>
            <Text fz={12} c="dimmed">{sunPos == null ? tx('city.sun.sunDown') : tx('city.sun.passed', { p: Math.round(sunPos * 100) })}</Text>
            <Text fz={12} c="dimmed">{tx('city.sun.sunset')}</Text>
          </Group>
        </Box>
        <div className="stat-grid">
          <Stat k={tx('city.sun.uvNow')} v={n0(c.uv_index)} s={uvAdvice(c.uv_index)} />
          <Stat k={tx('city.sun.uvMaxToday')} v={n0(dv.uv_index_max[t])} s={tx('city.sun.clearSkyMax', { v: n0(dv.uv_index_clear_sky_max[t]) })} />
          <Stat k={tx('city.sun.sunshineToday')} v={duration(dv.sunshine_duration[t])} />
          <Stat k={tx('common.tomorrow')} v={hhmm(data.daily.sunrise[t + 1])} s={tx('city.sun.sunsetAt', { time: hhmm(data.daily.sunset[t + 1]) })} />
        </div>
      </Section>

      <Section title={tx('city.precip.title')}>
        <div className="stat-grid">
          <Stat k={tx('common.now')} v={`${n0(c.precipitation, 1)} mm`} s={tx('city.precip.nowDetail', { rain: n0(c.rain, 1), showers: n0(c.showers, 1), snow: n0(c.snowfall, 1) })} />
          <Stat k={tx('common.today')} v={`${n0(dv.precipitation_sum[t], 1)} mm`} s={tx('city.precip.todayDetail', { h: n0(dv.precipitation_hours[t]), p: precipProb })} />
          <Stat k={tx('city.precip.snowfallToday')} v={`${n0(dv.snowfall_sum[t], 1)} cm`} s={(hv.snow_depth[h0] ?? 0) > 0 ? tx('city.precip.snowOnGround', { cm: Math.round((hv.snow_depth[h0] ?? 0) * 100) }) : tx('city.precip.noSnow')} />
          <Stat k={tx('common.tomorrow')} v={`${n0(dv.precipitation_sum[t + 1], 1)} mm`} s={tx('city.precip.chance', { p: dv.precipitation_probability_max[t + 1] ?? 0 })} />
        </div>
      </Section>

      <Section title={tx('city.wind.title')} summary={tx('city.wind.summary', { force: beaufort(c.wind_speed_10m), dir: compass(c.wind_direction_10m ?? 0) })}>
        <div className="stat-grid">
          <Stat k={tx('city.wind.title')} v={W(c.wind_speed_10m)} s={
            <Group gap={4} component="span">
              <span style={{ display: 'inline-flex', transform: `rotate(${(c.wind_direction_10m ?? 0) + 180}deg)` }}><Icon name="arrowUp" size={12} /></span>
              {tx('city.wind.from', { dir: compass(c.wind_direction_10m ?? 0), deg: n0(c.wind_direction_10m) })}
            </Group>
          } />
          <Stat k={tx('city.wind.gusts')} v={W(c.wind_gusts_10m)} s={beaufort(c.wind_gusts_10m)} />
          <Stat k={tx('city.wind.maxToday')} v={W(dv.wind_speed_10m_max[t])} s={tx('city.wind.gustsUpTo', { v: W(dv.wind_gusts_10m_max[t]) })} />
          <Stat k={tx('common.tomorrow')} v={W(dv.wind_speed_10m_max[t + 1])} s={tx('city.wind.gustsUpTo', { v: W(dv.wind_gusts_10m_max[t + 1]) })} />
        </div>
      </Section>

      <Section title={tx('city.air.title')} summary={air ? tx('city.air.now', { level: aqiLvl != null ? levelName(aqiLvl) : tx('city.air.unknown') }) + (aqiAhead ? tx('city.air.worst', { v: Math.round(aqiAhead.v), time: hhmm(aqiAhead.time) }) : '') : tx('city.air.unavailable')}>
        {air && (
          <>
            <div className="stat-grid">
              <Stat k={tx('city.air.euAqi')} v={n0(aqi)} s={aqiLvl != null ? levelName(aqiLvl) : '–'}>
                <Bar pct={((aqi ?? 0) / 120) * 100} level={aqiLvl} />
              </Stat>
              <Stat k={tx('city.air.usAqi')} v={n0(air.current.us_aqi)} s={usAqiLabel(air.current.us_aqi)}>
                <Bar pct={((air.current.us_aqi ?? 0) / 300) * 100} color="var(--mantine-color-dark-1)" />
              </Stat>
            </div>
            {POLLUTANTS.map((p) => {
              const v = air.current[p.key];
              const lvl = pollutantLevel(p.key, v);
              return (
                <Box key={p.key} py={8} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 64px 84px', gap: 8, alignItems: 'center' }}>
                  <Box><Text fz={13} fw={600}>{tx(`city.air.${p.key}` as MessageKey)}</Text><Text fz={12} c="dimmed">{p.unit}</Text></Box>
                  <Text fz={15} fw={800}>{n0(v)}</Text>
                  <Box><Text fz={12} c="dimmed">{lvl != null ? levelName(lvl) : '—'}</Text>{lvl != null && <Bar pct={((lvl + 1) / 6) * 100} level={lvl} />}</Box>
                </Box>
              );
            })}
            <div className="stat-grid">
              <Stat k={tx('city.air.dust')} v={`${n0(air.current.dust)} µg/m³`} s={tx('city.air.dustNote')} />
              <Stat k={tx('city.air.haze')} v={n0(air.current.aerosol_optical_depth, 2)} s={tx('city.air.hazeNote')} />
            </div>
          </>
        )}
      </Section>

      {pollen.length > 0 && (
        <Section title={tx('city.pollen.title')} summary={pollen.some((p) => (p.v ?? 0) >= 0.5)
          ? tx('city.pollen.summary')
          : tx('city.pollen.none')}>
          {pollen.some((p) => (p.v ?? 0) >= 0.5) && pollen.map((p) => (
            <Box key={p.name} py={8} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 56px 96px', gap: 8, alignItems: 'center' }}>
              <Text fz={13} fw={600}>{p.name}</Text>
              <Text fz={15} fw={800}>{n0(p.v)}</Text>
              <Box><Text fz={12} c="dimmed">{p.lvl?.label}</Text><Bar pct={(((p.lvl?.level ?? 0) + 1) / 5) * 100} color={levelColor(p.lvl ? p.lvl.level : null)} /></Box>
            </Box>
          ))}
        </Section>
      )}

      <Section title={tx('city.sky.title')}>
        <div className="stat-grid">
          <Stat k={tx('city.sky.cloudCover')} v={`${n0(c.cloud_cover)}%`}><Bar pct={c.cloud_cover ?? 0} color="var(--mantine-color-dark-1)" /></Stat>
          <Stat k={tx('city.sky.visibility')} v={c.visibility == null ? '–' : `${(c.visibility / 1000).toFixed(c.visibility < 10000 ? 1 : 0)} km`} s={visibilityLabel(c.visibility)} />
          <Stat k={tx('city.sky.lowClouds')} v={`${n0(hv.cloud_cover_low[h0])}%`} s={tx('city.sky.below3')}><Bar pct={hv.cloud_cover_low[h0] ?? 0} color="var(--mantine-color-dark-2)" /></Stat>
          <Stat k={tx('city.sky.midHigh')} v={`${n0(hv.cloud_cover_mid[h0])}% / ${n0(hv.cloud_cover_high[h0])}%`} s={tx('city.sky.midHighNote')} />
        </div>
      </Section>

      <Section title={tx('city.atmosphere.title')}>
        <div className="stat-grid">
          <Stat k={tx('city.atmosphere.pressure')} v={`${n0(c.pressure_msl)} hPa`} s={trend ? tx('city.atmosphere.trend', { label: trend.label, delta: `${trend.delta >= 0 ? '+' : '−'}${Math.abs(trend.delta).toFixed(1)}` }) : tx('city.atmosphere.seaLevel')} />
          <Stat k={tx('city.atmosphere.thunder')} v={capeLabel(hv.cape[h0])} s={`CAPE ${n0(hv.cape[h0])} J/kg`} />
          <Stat k={tx('city.atmosphere.freezing')} v={hv.freezing_level_height[h0] == null ? '–' : `${Math.round(hv.freezing_level_height[h0]!)} m`} s={tx('city.atmosphere.freezingNote')} />
          <Stat k={tx('city.atmosphere.evaporation')} v={`${n0(dv.et0_fao_evapotranspiration[t], 1)} mm`} s={tx('city.atmosphere.evaporationNote')} />
        </div>
      </Section>

      {marine && (
        <Section title={tx('city.sea.title')}>
          <div className="stat-grid">
            <Stat k={tx('city.sea.waves')} v={marine.current.wave_height == null ? '–' : `${marine.current.wave_height.toFixed(1)} m`} s={tx('city.sea.wavesNote', { dir: compass(marine.current.wave_direction ?? 0), s: n0(marine.current.wave_period) })} />
            <Stat k={tx('city.sea.swell')} v={marine.current.swell_wave_height == null ? '–' : `${marine.current.swell_wave_height.toFixed(1)} m`} />
            <Stat k={tx('city.sea.temperature')} v={`${T(marine.current.sea_surface_temperature)}°`} />
          </div>
        </Section>
      )}

      <Box mx={12} mt={24}>
        <Button className="glass" variant="default" size="lg" fullWidth
          rightSection={<Icon name="arrow" size={18} />} onClick={() => s.navigate({ name: 'history', cityId: city.id })}>
          {tx('city.historyButton', { logged: tx('common.daysLogged', { count: s.logged }) })}
        </Button>
      </Box>

      <Group justify="space-between" px={12} pt={12} pb={24} wrap="nowrap" align="flex-start">
        <Box>
          <Text fz={12} c="dimmed">{city.lat.toFixed(2)}°, {city.lon.toFixed(2)}° · {Math.round(data.elevation)} m · {data.timezone}</Text>
          <Text fz={12} c="dimmed">{tx('city.footer', { ago: ago(fetchedAt) })}</Text>
        </Box>
        <ActionIcon size={36} aria-label={s.loading ? tx('common.updating') : tx('common.refresh')} aria-busy={s.loading || undefined}
          onClick={() => void refreshCity(city.id, { maxAgeMs: 0 })}>
          <span className={s.loading ? 'spin' : undefined}><Icon name="refresh" size={16} /></span>
        </ActionIcon>
      </Group>
    </>
  );
}
