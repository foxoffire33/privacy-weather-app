import { Badge, Box, Button, Group, Text } from '@mantine/core';
import { useDragControls } from 'motion/react';
import { Suspense, useDeferredValue, useRef } from 'react';
import { useNavigate } from 'react-router';

import { Section } from '../components/city/Parts';
import { DayActions } from '../components/day/DayActions';
import { DayAir, DayHourly, DayPrecip, DaySky, DaySource, DaySun, DayTemperature, DayWind } from '../components/day/DaySections';
import { MotionBox } from '../components/motionComponents';
import { ScreenHeader } from '../components/ScreenHeader';
import { ChartSk, SectionSk, Sk } from '../components/Skeletons';
import { t } from '../i18n';
import { openDay, useCity, useDayData, useDayQuery, useDayRecord, useLogNeighbours, useNormals, useSettings, useUnits } from '../stores';
import { MOTION } from '../theme';
import { fmtDelta, fmtTemp, fullDate } from '../utils/format';
import { paths, SWIPE_NEXT_STATE, SWIPE_PREV_STATE } from '../utils/paths';
import { conditionLabel } from '../utils/weatherCodes';

import type { DayData, DayRecord } from '../stores';
import type { DayBodyProps, DayHeaderProps, DayHeroValues, DayViewProps } from '../types';
import type { PanInfo } from 'motion/react';
import type { ReactElement } from 'react';

const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 0.2;
const EDGE_ELASTIC = 0.25;


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

function sourceLabel(source: DayRecord['source']): string {
  if (source === 'log') { return t('dayView.logged'); }
  return source === 'edited' ? t('dayView.edited') : t('dayView.filled');
}

function recordValues(record: DayRecord): DayHeroValues {
  return { hi: record.hi ?? null, lo: record.lo, feelsHi: record.feelsHi, feelsLo: record.feelsLo, code: record.code };
}

const EMPTY_RECORD: Partial<DayRecord> = {};

function heroValues(day: DayData | undefined, record: DayRecord | undefined): DayHeroValues {
  if (record?.source === 'edited') { return recordValues(record); }
  const d = day?.daily.v ?? {};
  const r = record ?? EMPTY_RECORD;
  return {
    hi: d.temperature_2m_max ?? r.hi ?? null,
    lo: d.temperature_2m_min ?? r.lo,
    feelsHi: d.apparent_temperature_max ?? r.feelsHi,
    feelsLo: d.apparent_temperature_min ?? r.feelsLo,
    code: d.weather_code ?? r.code,
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
  const { prev, next } = useLogNeighbours(cityId, date);
  const navigate = useNavigate();
  const settled = useDeferredValue(true, false);
  const controls = useDragControls();
  const axis = useRef<'x' | 'y' | null>(null);
  const onDragEnd = (event: PointerEvent, info: PanInfo) => {
    const locked = axis.current;
    axis.current = null;
    if (event.type === 'pointercancel' || locked !== 'x') { return; }
    const swipe = info.offset.x + info.velocity.x * SWIPE_VELOCITY;
    const target = swipe < 0 ? next : prev;
    if (target === undefined || Math.abs(swipe) < SWIPE_DISTANCE) { return; }
    void navigate(paths.day(cityId, target), { replace: true, state: swipe < 0 ? SWIPE_NEXT_STATE : SWIPE_PREV_STATE });
  };
  return (
    <MotionBox drag="x" dragListener={false} dragControls={controls} dragDirectionLock dragSnapToOrigin dragMomentum={false}
      dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: next === undefined ? EDGE_ELASTIC : 1, right: prev === undefined ? EDGE_ELASTIC : 1 }}
      dragTransition={MOTION.settle} onDirectionLock={(a) => { axis.current = a; }} onDragEnd={onDragEnd} style={{ touchAction: 'pan-y' }}>
      <Box className="hero" onPointerDown={(e) => { controls.start(e); }} style={{ paddingTop: 8, touchAction: 'pan-y' }}>
        <Box ml={-12} mb={8} c="white"><ScreenHeader /></Box>
        <Group gap={8}>
          <Text fz={15} fw={800}>{cityName}</Text>
          {record && <Badge variant="white" color="dark" size="sm">{sourceLabel(record.source)}</Badge>}
        </Group>
        <Text fz={13} fw={600}>{fullDate(date)}</Text>
        <Box className="hero-temp">{T(v.hi)}°</Box>
        <Text fz={20} fw={800} mt={8}>{conditionLabel(v.code)}</Text>
        <Text fz={13} fw={600}>
          {t('dayView.lowLine', { lo: T(v.lo), fhi: T(v.feelsHi), flo: T(v.feelsLo) })}
          {delta !== '' && ` · ${t('city.vsAverage', { delta })}`}
        </Text>
      </Box>

      <DayActions cityId={cityId} date={date} record={record} />

      <Suspense fallback={<DayDetailsSk />}>
        {settled ? <DayDetails cityId={cityId} date={date} /> : <DayDetailsSk />}
      </Suspense>
    </MotionBox>
  );
}

function DayDetails({ cityId, date }: DayViewProps): ReactElement {
  const units = useUnits();
  const day = useDayData(cityId, date);
  const query = useDayQuery(cityId, date);
  const normal = useNormals(cityId)?.[date.slice(5)];
  const offline = useSettings().offline;
  if (!day) {
    if (offline) { return <Text px={20} py={20} fz={13} c="dimmed">{t('offline.dayNote')}</Text>; }
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
