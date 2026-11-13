import { Box, Collapse, Text, UnstyledButton } from '@mantine/core';

import { t } from '../../i18n';
import { useUiStore } from '../../stores/uiStore';
import { compass, fmtTemp, fmtWind, hhmm, weekday } from '../../utils/format';
import { duration, uvAdvice } from '../../weather/insights';
import { conditionLabel } from '../../weather/weatherCodes';

import { n0 } from './num';
import { Stat } from './Parts';

import type { DayRowProps, ExpandableProps } from '../../types';
import type { ReactElement } from 'react';

function DayRow({ cityId, entry, units, date, index: i, label, open }: DayRowProps): ReactElement {
  const toggleDay = useUiStore((st) => st.toggleDay);
  const { data } = entry;
  const dv = data.daily.v;
  const T = (v?: number | null) => fmtTemp(v, units.temp);
  const W = (v?: number | null) => fmtWind(v, units.wind);
  return (
    <Box className="row" data-on={open || undefined}>
      <UnstyledButton w="100%" px={12} py={9} onClick={() => { toggleDay(cityId, date); }}
        style={{ display: 'grid', gridTemplateColumns: '52px 1fr 44px 40px 32px', alignItems: 'center', gap: 4 }}>
        <Text fz={14} fw={800}>{label}</Text>
        <Text fz={12} c="dimmed" truncate>{conditionLabel(dv.weather_code[i])}</Text>
        <Text fz={12} fw={600} c="signal.3">{dv.precipitation_probability_max[i] ?? 0}%</Text>
        <Text fz={14} fw={800}>{T(dv.temperature_2m_max[i])}°</Text>
        <Text fz={14} c="dimmed">{T(dv.temperature_2m_min[i])}°</Text>
      </UnstyledButton>
      <Collapse expanded={open} keepMounted={false}>
        <Box className="stat-grid" px={12} pb={8}>
          <Stat k={t('city.day.feelsLike')} v={`${T(dv.apparent_temperature_max[i])}° / ${T(dv.apparent_temperature_min[i])}°`} />
          <Stat k={t('city.day.precipitation')} v={`${n0(dv.precipitation_sum[i], 1)} mm`} s={t('city.day.precipDetail', { h: n0(dv.precipitation_hours[i]), rain: n0(dv.rain_sum[i], 1), showers: n0(dv.showers_sum[i], 1) })} />
          <Stat k={t('city.day.snowfall')} v={`${n0(dv.snowfall_sum[i], 1)} cm`} />
          <Stat k={t('city.day.wind')} v={W(dv.wind_speed_10m_max[i])} s={t('city.day.windDetail', { gusts: W(dv.wind_gusts_10m_max[i]), dir: compass(dv.wind_direction_10m_dominant[i] ?? 0) })} />
          <Stat k={t('city.day.uvMax')} v={n0(dv.uv_index_max[i])} s={uvAdvice(dv.uv_index_max[i])} />
          <Stat k={t('city.day.sunshine')} v={duration(dv.sunshine_duration[i])} s={t('city.day.ofDaylight', { d: duration(dv.daylight_duration[i]) })} />
          <Stat k={t('city.day.sunrise')} v={hhmm(data.daily.sunrise[i])} s={t('city.sun.sunsetAt', { time: hhmm(data.daily.sunset[i]) })} />
          <Stat k={t('city.day.solarEnergy')} v={`${n0(dv.shortwave_radiation_sum[i], 1)} MJ/m²`} />
        </Box>
      </Collapse>
    </Box>
  );
}

export function DayList({ city, entry, units, expanded }: ExpandableProps): ReactElement {
  const d = entry.pastDays;
  const days = entry.data.daily.time.slice(d, d + 7);
  return (
    <>
      {days.map((date, k) => (
        <DayRow key={date} cityId={city.id} entry={entry} units={units} date={date} index={d + k}
          label={k === 0 ? t('common.today') : weekday(date)} open={expanded === date} />
      ))}
    </>
  );
}
