import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { useMergedRef, useScroller } from '@mantine/hooks';
import { animate, useMotionValue } from 'motion/react';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { t } from '../../i18n';
import { addDays, openDay, useDayQuery, useDayStore } from '../../stores';
import { MOTION } from '../../theme';
import { convWind, fmtTemp, hhmm, hourLabel, hourOf, orDash, weekday } from '../../utils/format';
import { nowIndex } from '../../utils/insights';
import { paths } from '../../utils/paths';
import { Icon } from '../Icon';
import { MotionBox } from '../motionComponents';

import type { DayData, ForecastEntry } from '../../stores';
import type { DayDividerProps, ExpandableProps, NowcastProps, StripCell, StripLabel } from '../../types';
import type { PanInfo } from 'motion/react';
import type { ReactElement, WheelEvent } from 'react';

const PULL_TRIGGER = 64;
const PULL_MAX = 96;
const PULL_RATIO = 0.5;

function pullWidth(info: PanInfo): number {
  return Math.min(PULL_MAX, Math.max(0, info.offset.x * PULL_RATIO));
}

function wheelAcross(e: WheelEvent<HTMLDivElement>): void {
  const el = e.currentTarget;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { return; }
  const atEnd = (e.deltaY > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) || (e.deltaY < 0 && el.scrollLeft <= 0);
  if (!atEnd) { el.scrollBy({ left: e.deltaY }); }
}

function pullLabel(loading: boolean, armed: boolean, back: number): string {
  if (loading) { return '…'; }
  if (armed) { return t('city.release'); }
  return back === 0 ? t('city.yesterday') : t('city.earlier');
}

function pastCells(day: DayData): StripCell[] {
  const v = day.hourly.v;
  return day.hourly.time.map((time, k) => ({
    time, date: time.slice(0, 10), isNow: false, past: true,
    temp: v.temperature_2m?.[k], p: v.precipitation_probability?.[k] ?? null, wind: v.wind_speed_10m?.[k],
  }));
}

function forecastCells(entry: ForecastEntry, from: number): StripCell[] {
  const { data } = entry;
  const h0 = nowIndex(data);
  const hv = data.hourly.v;
  return data.hourly.time.slice(from).map((time, k) => {
    const i = from + k;
    return {
      time, date: time.slice(0, 10), isNow: i === h0, past: i < h0,
      temp: i === h0 ? data.current.v.temperature_2m : hv.temperature_2m[i], p: hv.precipitation_probability[i] ?? 0, wind: hv.wind_speed_10m[i],
    };
  });
}

function labelCells(cells: StripCell[]): StripLabel[] {
  return cells.map((h, k) => {
    const dayBreak = hourOf(h.time) === '00' && k > 0;
    return {
      ...h,
      label: h.isNow ? t('common.now') : hourLabel(h.time),
      dayBreak,
      dayName: dayBreak ? weekday(h.date).toLocaleUpperCase() : '',
    };
  });
}

function DayDivider({ name, on }: DayDividerProps): ReactElement {
  return (
    <Box className="day-divider" data-on={on || undefined} aria-label={name}>
      <Box component="i" />
      {Array.from(name, (ch, n) => ({ ch, id: `${ch}-${String(n)}` })).map(({ ch, id }) => <Box component="span" key={id}>{ch}</Box>)}
      <Box component="i" />
    </Box>
  );
}

export function Nowcast({ entry }: NowcastProps): ReactElement | null {
  const mq = entry.data.minutely15;
  if (mq === null) { return null; }
  const mMax = Math.max(0.5, ...mq.precipitation.map((v) => v ?? 0));
  return (
    <>
      <Box className="nowcast" style={{ marginTop: 8 }}>
        {mq.precipitation.map((v, i) => (
          <Box key={mq.time[i]} style={{ height: `${String(Math.max(6, ((v ?? 0) / mMax) * 100))}%`, background: (v ?? 0) >= 0.1 ? 'var(--mantine-color-signal-4)' : 'rgba(255,255,255,.12)' }} />
        ))}
      </Box>
      <Group justify="space-between" mt={4}>
        <Text fz={12} c="dimmed">{hhmm(mq.time[0])}</Text>
        <Text fz={12} c="dimmed">{t('city.nowcastCaption')}</Text>
        <Text fz={12} c="dimmed">{hhmm(mq.time.at(-1))}</Text>
      </Group>
    </>
  );
}

export function HourlyStrip({ city, entry, units, expanded }: ExpandableProps): ReactElement {
  const days = useDayStore((st) => st.days);
  const navigate = useNavigate();
  const stripRef = useRef<HTMLDivElement>(null);
  const pullW = useMotionValue(0);
  const pulling = useRef(false);
  const scroller = useScroller();
  const [back, setBack] = useState(0);
  const [armed, setArmed] = useState(false);
  const widthBefore = useRef(0);
  const today = entry.data.daily.time[entry.pastDays];
  const loadingPast = useDayQuery(city.id, addDays(today, -(back + 1))).status === 'loading';
  const loadPast = async () => {
    const el = stripRef.current;
    if (!el) { return; }
    const n = back + 1;
    if (n > 1) {
      const date = addDays(today, -n);
      await openDay(city.id, date);
      if (!useDayStore.getState().days[`${city.id}:${date}`]) { return; }
    }
    widthBefore.current = el.scrollWidth;
    setBack(n);
  };
  const onPanStart = () => { pulling.current = !scroller.canScrollStart && !loadingPast; };
  const onPan = (_: PointerEvent, info: PanInfo) => {
    if (!pulling.current) { return; }
    const width = pullWidth(info);
    pullW.set(width);
    setArmed(width >= PULL_TRIGGER);
  };
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    if (!pulling.current) { return; }
    pulling.current = false;
    void animate(pullW, 0, MOTION.quick);
    setArmed(false);
    if (pullWidth(info) >= PULL_TRIGGER) { void loadPast(); }
  };
  const ref = useMergedRef(stripRef, scroller.ref);
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el || back === 0) { return; }
    const added = el.scrollWidth - widthBefore.current;
    el.scrollTo({ left: added, behavior: 'instant' });
    el.scrollTo({ left: Math.max(0, added - 3 * 52), behavior: 'smooth' });
  }, [back, stripRef]);
  useEffect(() => {
    const el = stripRef.current;
    const first = expanded === null ? null : el?.querySelector<HTMLElement>(`[data-date="${CSS.escape(expanded)}"]`);
    if (!el || !first) { return; }
    const prev = first.previousElementSibling;
    const anchor = prev instanceof HTMLElement && prev.classList.contains('day-divider') ? prev : first;
    el.scrollTo({ left: anchor.offsetLeft, behavior: 'smooth' });
  }, [expanded, stripRef]);
  const cells: StripCell[] = [];
  for (let n = back; n >= 2; n--) {
    const day = days[`${city.id}:${addDays(today, -n)}`];
    if (day) { cells.push(...pastCells(day)); }
  }
  cells.push(...forecastCells(entry, back >= 1 ? 0 : nowIndex(entry.data)));
  const hours = labelCells(cells);
  const first = hours.at(0);
  return (
    <>
      <MotionBox className="hourly-strip" ref={ref} data-noswipe {...scroller.dragHandlers} onWheel={wheelAcross}
        onPanStart={onPanStart} onPan={onPan} onPanEnd={onPanEnd}
        style={{ touchAction: scroller.canScrollStart ? 'pan-x pan-y' : 'pan-right pan-y' }}>
        <MotionBox className="pull-past" data-armed={armed || undefined} style={{ width: pullW }}>
          {pullLabel(loadingPast, armed, back)}
        </MotionBox>
        {hours.map((h) => (
          <Fragment key={h.time}>
            {h.dayName !== '' && <DayDivider name={h.dayName} on={h.date === expanded} />}
            <Box data-date={h.dayBreak || h.time === first?.time ? h.date : undefined} data-now={h.isNow || undefined} data-on={h.date === expanded || undefined} style={h.past ? { opacity: 0.82 } : undefined}>
              <Text fz={12} c="dimmed" fw={h.dayBreak ? 800 : 400}>{h.label}</Text>
              <Text fz={16} fw={800}>{fmtTemp(h.temp, units.temp)}°</Text>
              <Text fz={12} fw={600} c="signal.3">{h.p === null ? '–' : `${String(h.p)}%`}</Text>
              <Text fz={12} c="dimmed">{orDash(convWind(h.wind, units.wind), (n) => String(Math.round(n)))}</Text>
            </Box>
          </Fragment>
        ))}
      </MotionBox>
      <UnstyledButton w="100%" px={12} py={10} onClick={() => { void navigate(paths.hourly(city.id)); }}
        style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(248,244,244,.2)' }}>
        <Text fz={13} fw={800}>{t('city.hourlyLink')}</Text>
        <Icon name="arrow" size={16} />
      </UnstyledButton>
    </>
  );
}
