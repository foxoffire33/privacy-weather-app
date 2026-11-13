import { Box, Group, SimpleGrid, Text, Title } from '@mantine/core';
import { Suspense } from 'react';

import { ScreenHeader } from '../components/ScreenHeader';
import { Sk } from '../components/Skeletons';
import { t } from '../i18n';
import { compass, fmtTemp, fmtWind, hhmm, longDate, orDash } from '../lib/format';
import { nowIndex } from '../lib/insights';
import { conditionLabel } from '../lib/weatherCodes';
import { useCity, useForecastData, useUnits } from '../stores';

import type { CityScreenProps, HourGroup, HourlyCellProps } from '../types';
import type { ReactElement } from 'react';

function Cell({ k, v }: HourlyCellProps) {
  return (
    <Box py={8} pr={8}>
      <Text fz={12} tt="uppercase" c="dimmed" style={{ letterSpacing: '.06em' }}>{k}</Text>
      <Text fz={16} fw={800}>{v}</Text>
    </Box>
  );
}

function HourBlockSk() {
  return (
    <Box mt={10} p={14} style={{ border: '2px solid var(--rule)' }}>
      <Group justify="space-between" align="flex-start"><Box><Sk w={56} h={20} /><Sk w={120} h={14} mt={8} /></Box><Sk w={72} h={44} /></Group>
      <Sk h={96} mt={14} />
    </Box>
  );
}

export function Hourly({ cityId }: CityScreenProps): ReactElement {
  const city = useCity(cityId);
  if (!city) {return <Box className="screen"><ScreenHeader /><Text px={20}>{t('common.noLongerFollowed')}</Text></Box>;}
  const header = (
    <>
      <ScreenHeader />
      <Text px={20} fz={13} c="dimmed">{city.name}</Text>
      <Title className="display display-sm" style={{ whiteSpace: 'pre-line' }}>{t('hourly.title')}</Title>
    </>
  );
  return (
    <Box className="screen">
      {header}
      <Suspense fallback={<Box px={12} pb={24}><Sk w={180} h={12} mt={20} />{[0, 1, 2].map((i) => <HourBlockSk key={i} />)}</Box>}>
        <HourlyBody cityId={cityId} />
      </Suspense>
    </Box>
  );
}

function HourlyBody({ cityId }: CityScreenProps) {
  const units = useUnits();
  const entry = useForecastData(cityId);
  const s = { entry, tempUnit: units.temp, windUnit: units.wind };
  if (!s.entry) {return <Text px={20} py={20} fz={13} c="dimmed">{t('city.couldNotLoad')}</Text>;}

  const { data } = s.entry;
  const v = data.hourly.v;
  const h0 = nowIndex(data);
  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const W = (k?: number | null) => fmtWind(k, s.windUnit);
  const groups: HourGroup[] = [];
  for (let i = h0; i < data.hourly.time.length; i++) {
    const date = data.hourly.time[i].slice(0, 10);
    const last = groups.at(-1);
    if (last?.date === date) { last.rows.push(i); } else { groups.push({ date, rows: [i] }); }
  }

  return (
    <Box px={12} pb={24}>
      {groups.map((g) => (
        <Box key={g.date}>
          <Box px={8}><Box className="kicker">{longDate(g.date)}</Box></Box>
          {g.rows.map((i) => {
            const mm = v.precipitation[i] ?? 0;
            const isNow = i === h0;
            return (
              <Box key={i} mt={10} p={14}
                style={{ border: `${String(isNow ? 2 : 1)}px solid ${isNow ? "#fff" : "var(--rule-soft)"}`, background: (v.is_day[i] !== null && v.is_day[i] !== 0) ? '#000' : '#0b0b0b' }}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Box style={{ minWidth: 0 }}>
                    <Text fz={20} fw={800}>{isNow ? t('common.now') : hhmm(data.hourly.time[i])}</Text>
                    <Text fz={14} fw={600} truncate>{conditionLabel(v.weather_code[i])}{(v.is_day[i] !== null && v.is_day[i] !== 0) ? '' : ` · ${t('common.night')}`}</Text>
                  </Box>
                  <Text fz={48} fw={800} lh={0.9} style={{ letterSpacing: '-.04em' }}>{T(v.temperature_2m[i])}°</Text>
                </Group>
                <SimpleGrid mt={10} cols={3} spacing={0} verticalSpacing={0} style={{ borderTop: '1px solid var(--rule-soft)' }}>
                  <Cell k={t('hourly.feelsLike')} v={`${T(v.apparent_temperature[i])}°`} />
                  <Cell k={t('hourly.rainChance')} v={`${String(v.precipitation_probability[i] ?? 0)}%`} />
                  <Cell k={t('hourly.rain')} v={`${mm.toFixed(1)} mm`} />
                  <Cell k={t('hourly.wind', { dir: compass(v.wind_direction_10m[i] ?? 0) })} v={W(v.wind_speed_10m[i])} />
                  <Cell k={t('hourly.gusts')} v={W(v.wind_gusts_10m[i])} />
                  <Cell k={t('hourly.uv')} v={orDash(v.uv_index.at(i), (n) => String(Math.round(n)))} />
                  <Cell k={t('hourly.clouds')} v={`${String(v.cloud_cover[i] ?? '–')}%`} />
                  <Cell k={t('hourly.humidity')} v={`${String(v.relative_humidity_2m[i] ?? '–')}%`} />
                  <Cell k={t('hourly.visibility')} v={orDash(v.visibility.at(i), (n) => `${String(Math.round(n / 1000))} km`)} />
                </SimpleGrid>
              </Box>
            );
          })}
        </Box>
      ))}
      <Text fz={12} c="dimmed" pt={16} px={8}>{t('common.dataBy')}</Text>
    </Box>
  );
}
