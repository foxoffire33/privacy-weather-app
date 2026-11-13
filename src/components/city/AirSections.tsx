import { Box, Text } from '@mantine/core';

import { t } from '../../i18n';
import { hhmm } from '../../lib/format';
import { euAqiLevel, levelName, nowIndex, pollenLevel, pollutantLevel, usAqiLabel } from '../../lib/insights';

import { levelColor } from './levelColor';
import { n0 } from './num';
import { Bar, Section, Stat } from './Parts';

import type { MessageKey } from '../../i18n';
import type { AirData, ForecastData } from '../../stores';
import type { AqiPeak, NowcastProps, PollutantRowProps } from '../../types';
import type { ReactElement } from 'react';

const POLLUTANTS = [
  { key: 'pm2_5', label: 'city.air.pm2_5', unit: 'PM2.5 · µg/m³' },
  { key: 'pm10', label: 'city.air.pm10', unit: 'PM10 · µg/m³' },
  { key: 'nitrogen_dioxide', label: 'city.air.nitrogen_dioxide', unit: 'NO₂ · µg/m³' },
  { key: 'ozone', label: 'city.air.ozone', unit: 'O₃ · µg/m³' },
  { key: 'sulphur_dioxide', label: 'city.air.sulphur_dioxide', unit: 'SO₂ · µg/m³' },
  { key: 'carbon_monoxide', label: 'city.air.carbon_monoxide', unit: 'CO · µg/m³' },
] as const satisfies readonly { key: string; label: MessageKey; unit: string }[];

const POLLEN = [
  { key: 'alder_pollen', label: 'city.pollen.alder_pollen' },
  { key: 'birch_pollen', label: 'city.pollen.birch_pollen' },
  { key: 'grass_pollen', label: 'city.pollen.grass_pollen' },
  { key: 'mugwort_pollen', label: 'city.pollen.mugwort_pollen' },
  { key: 'olive_pollen', label: 'city.pollen.olive_pollen' },
  { key: 'ragweed_pollen', label: 'city.pollen.ragweed_pollen' },
] as const satisfies readonly { key: string; label: MessageKey }[];

function worstAhead(air: AirData, data: ForecastData): AqiPeak | null {
  const h0 = nowIndex(data);
  const start = data.hourly.time[h0];
  const end = data.hourly.time.at(h0 + 24);
  let worst: AqiPeak | null = null;
  for (const [i, time] of air.hourly.time.entries()) {
    const v = air.hourly.aqi[i];
    const inWindow = time >= start && (end === undefined || time <= end);
    if (inWindow && v !== null && (worst === null || v > worst.v)) { worst = { v, time }; }
  }
  return worst;
}

function airSummary(air: AirData | null, data: ForecastData): string {
  if (air === null) { return t('city.air.unavailable'); }
  const lvl = euAqiLevel(air.current.european_aqi);
  const peak = worstAhead(air, data);
  const now = t('city.air.now', { level: lvl === null ? t('city.air.unknown') : levelName(lvl) });
  return peak === null ? now : now + t('city.air.worst', { v: Math.round(peak.v), time: hhmm(peak.time) });
}

function PollutantRow({ label, unit, value, level }: PollutantRowProps): ReactElement {
  return (
    <Box py={8} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 64px 84px', gap: 8, alignItems: 'center' }}>
      <Box><Text fz={13} fw={600}>{label}</Text><Text fz={12} c="dimmed">{unit}</Text></Box>
      <Text fz={15} fw={800}>{n0(value)}</Text>
      <Box><Text fz={12} c="dimmed">{level === null ? '—' : levelName(level)}</Text>{level !== null && <Bar pct={((level + 1) / 6) * 100} level={level} />}</Box>
    </Box>
  );
}

export function AirSection({ entry }: NowcastProps): ReactElement {
  const { air, data } = entry;
  const aqi = air?.current.european_aqi ?? null;
  const aqiLvl = euAqiLevel(aqi);
  return (
    <Section title={t('city.air.title')} summary={airSummary(air, data)}>
      {air && (
        <>
          <Box className="stat-grid">
            <Stat k={t('city.air.euAqi')} v={n0(aqi)} s={aqiLvl === null ? '–' : levelName(aqiLvl)}>
              <Bar pct={((aqi ?? 0) / 120) * 100} level={aqiLvl} />
            </Stat>
            <Stat k={t('city.air.usAqi')} v={n0(air.current.us_aqi)} s={usAqiLabel(air.current.us_aqi)}>
              <Bar pct={((air.current.us_aqi ?? 0) / 300) * 100} color="var(--mantine-color-dark-1)" />
            </Stat>
          </Box>
          {POLLUTANTS.map((p) => (
            <PollutantRow key={p.key} label={t(p.label)} unit={p.unit} value={air.current[p.key]} level={pollutantLevel(p.key, air.current[p.key])} />
          ))}
          <Box className="stat-grid">
            <Stat k={t('city.air.dust')} v={`${n0(air.current.dust)} µg/m³`} s={t('city.air.dustNote')} />
            <Stat k={t('city.air.haze')} v={n0(air.current.aerosol_optical_depth, 2)} s={t('city.air.hazeNote')} />
          </Box>
        </>
      )}
    </Section>
  );
}

export function PollenSection({ entry }: NowcastProps): ReactElement | null {
  const { air } = entry;
  if (air === null) { return null; }
  const pollen = POLLEN.map((p) => ({ key: p.key, name: t(p.label), v: air.current[p.key], lvl: pollenLevel(air.current[p.key]) }))
    .filter((p) => p.v !== null);
  if (pollen.length === 0) { return null; }
  const present = pollen.some((p) => (p.v ?? 0) >= 0.5);
  return (
    <Section title={t('city.pollen.title')} summary={present ? t('city.pollen.summary') : t('city.pollen.none')}>
      {present && pollen.map((p) => (
        <Box key={p.key} py={8} className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 56px 96px', gap: 8, alignItems: 'center' }}>
          <Text fz={13} fw={600}>{p.name}</Text>
          <Text fz={15} fw={800}>{n0(p.v)}</Text>
          <Box><Text fz={12} c="dimmed">{p.lvl?.label}</Text><Bar pct={(((p.lvl?.level ?? 0) + 1) / 5) * 100} color={levelColor(p.lvl ? p.lvl.level : null)} /></Box>
        </Box>
      ))}
    </Section>
  );
}
