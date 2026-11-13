import { Badge, Box, Button, Group, Text } from '@mantine/core';
import { Suspense } from 'react';

import { Section } from '../components/city/Parts';
import { DayAir, DayHourly, DayPrecip, DaySky, DaySource, DaySun, DayTemperature, DayWind } from '../components/day/DaySections';
import { ScreenHeader } from '../components/ScreenHeader';
import { ChartSk, SectionSk, Sk } from '../components/Skeletons';
import { t } from '../i18n';
import { openDay, useCity, useDayData, useDayQuery, useDayRecord, useNormals, useUnits } from '../stores';
import { fmtDelta, fmtTemp, fullDate } from '../utils/format';
import { conditionLabel } from '../weather/weatherCodes';

import type { DayData, DayRecord } from '../stores';
import type { DayBodyProps, DayHeaderProps, DayHeroValues, DayViewProps } from '../types';
import type { ReactElement } from 'react';


export function DayView({ cityId, date }: DayViewProps): ReactElement {
  const city = useCity(cityId);
  if (!city) {return <Box className="screen"><ScreenHeader /><Text px={20}>{t('common.noLongerFollowed')}</Text></Box>;}
  return (
    <Box className="screen">
      <Suspense fallback={<DayViewSk cityName={city.name} date={date} />}>
        <DayBody cityId={cityId} date={date} cityName={city.name} />
      </Suspense>
    </Box>
  );
}

function DayViewSk({ cityName, date }: DayHeaderProps) {
  return (
    <>
      <Box className="hero" style={{ paddingTop: 8 }}>
        <Box ml={-12} mb={8} c="white"><ScreenHeader /></Box>
        <Text fz={15} fw={800}>{cityName}</Text>
        <Text fz={13} fw={600}>{fullDate(date)}</Text>
        <Sk w={200} h={143} mt={8} />
        <Sk w={140} h={22} mt={14} />
        <Sk w={260} h={14} mt={8} />
      </Box>
      <DayDetailsSk />
    </>
  );
}

function DayDetailsSk() {
  return (
    <>
      <Section title={t('dayView.hourByHour')}><ChartSk /></Section>
      <SectionSk title={t('dayView.temperature')} />
      <SectionSk title={t('city.precip.title')} />
      <SectionSk title={t('city.wind.title')} n={2} />
      <SectionSk title={t('city.sun.title')} />
    </>
  );
}

function heroValues(day: DayData | undefined, record: DayRecord | undefined): DayHeroValues {
  const d = day?.daily.v ?? {};
  return {
    hi: d.temperature_2m_max ?? record?.hi ?? null,
    lo: d.temperature_2m_min ?? record?.lo,
    feelsHi: d.apparent_temperature_max ?? record?.feelsHi,
    feelsLo: d.apparent_temperature_min ?? record?.feelsLo,
    code: d.weather_code ?? record?.code,
  };
}

function DayBody({ cityId, date, cityName }: DayBodyProps): ReactElement {
  const units = useUnits();
  const record = useDayRecord(cityId, date);
  const day = useDayData(cityId, date, record === undefined);
  const normal = useNormals(cityId)?.[date.slice(5)];
  const T = (c?: number | null) => fmtTemp(c, units.temp);
  const v = heroValues(day, record);
  const delta = normal !== undefined && v.hi !== null ? fmtDelta(v.hi - normal, units.temp) : '';
  return (
    <>
      <Box className="hero" style={{ paddingTop: 8 }}>
        <Box ml={-12} mb={8} c="white"><ScreenHeader /></Box>
        <Group gap={8}>
          <Text fz={15} fw={800}>{cityName}</Text>
          {record && <Badge variant="white" color="dark" size="sm">{record.source === 'log' ? t('dayView.logged') : t('dayView.filled')}</Badge>}
        </Group>
        <Text fz={13} fw={600}>{fullDate(date)}</Text>
        <Box className="hero-temp">{T(v.hi)}°</Box>
        <Text fz={20} fw={800} mt={8}>{conditionLabel(v.code)}</Text>
        <Text fz={13} fw={600}>
          {t('dayView.lowLine', { lo: T(v.lo), fhi: T(v.feelsHi), flo: T(v.feelsLo) })}
          {delta !== '' && ` · ${t('city.vsAverage', { delta })}`}
        </Text>
      </Box>

      <Suspense fallback={<DayDetailsSk />}>
        <DayDetails cityId={cityId} date={date} />
      </Suspense>
    </>
  );
}

function DayDetails({ cityId, date }: DayViewProps): ReactElement {
  const units = useUnits();
  const day = useDayData(cityId, date);
  const query = useDayQuery(cityId, date);
  const normal = useNormals(cityId)?.[date.slice(5)];
  if (!day) {
    return (
      <Box p={20}>
        <Text fw={800}>{t('dayView.couldNotLoad')}</Text>
        <Text fz={13} c="dimmed">{query.error}</Text>
        <Button mt={12} variant="outline" color="gray" onClick={() => void openDay(cityId, date)}>{t('common.tryAgain')}</Button>
      </Box>
    );
  }
  return (
    <>
      <DayHourly day={day} units={units} cityId={cityId} />
      <DayTemperature day={day} units={units} normal={normal} />
      <DayPrecip day={day} units={units} />
      <DayWind day={day} units={units} />
      <DaySun day={day} units={units} />
      <DaySky day={day} units={units} />
      <DayAir day={day} units={units} />
      <DaySource day={day} units={units} />
    </>
  );
}
