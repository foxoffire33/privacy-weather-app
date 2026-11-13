import { BarChart, LineChart } from '@mantine/charts';
import { Box, Button, Checkbox, Drawer, Group, Modal, Text, TextInput, UnstyledButton } from '@mantine/core';
import { Suspense, use, useEffect, useEffectEvent, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { t } from '../../i18n';
import { convTemp, convWind, shortDate, windUnitLabel } from '../../lib/format';
import { addDays, daysBetween, lastSettled, latest, useLogStore } from '../../stores';
import { hasGap, hasLogged, trendsKey, useTrendsStore, windowKey } from '../../stores/trendsStore';
import { ExpandButton, FullscreenChart, INLINE_HEIGHT } from '../charts/FullscreenChart';
import { useSeriesToggle } from '../charts/SeriesToggle';
import { ChartSk } from '../Skeletons';

import type { TempUnit } from '../../stores';
import type {
  ChartHeight, GroupChartProps, RangeSheetProps, SheetCloseProps, TrendAttr, TrendChartsProps, TrendControlsProps, TrendGroup, TrendGroupDef,
  TrendNames, TrendRangeInput, TrendRowInput, TrendsFillProps, TrendsProps, TrendsSheet, TrendWindow,
} from '../../types';
import type { ReactElement } from 'react';

const T = (c: number | null | undefined, unit: TempUnit) => convTemp(c, unit);

const ATTRS: TrendAttr[] = [
  { key: 'hi', label: 'city.high', group: 'temp', value: (r, _n, u) => T(r?.hi, u.temp) },
  { key: 'lo', label: 'city.low', group: 'temp', value: (r, _n, u) => T(r?.lo, u.temp) },
  { key: 'normal', label: 'history.normal', group: 'temp', value: (_r, n, u) => T(n, u.temp) },
  { key: 'feelsHi', label: 'history.attrFeelsHi', group: 'temp', value: (r, _n, u) => T(r?.feelsHi, u.temp) },
  { key: 'feelsLo', label: 'history.attrFeelsLo', group: 'temp', value: (r, _n, u) => T(r?.feelsLo, u.temp) },
  { key: 'delta', label: 'history.metricDelta', group: 'temp', value: (r, n, u) => (n === null || (r?.hi === null || r?.hi === undefined) ? null : Math.round((u.temp === 'F' ? (r.hi - n) * 9 / 5 : r.hi - n) * 10) / 10) },
  { key: 'mm', label: 'city.day.precipitation', group: 'rain', value: (r) => r?.mm ?? null },
  { key: 'snow', label: 'city.day.snowfall', group: 'snow', value: (r) => r?.snow ?? null },
  { key: 'wind', label: 'city.wind.title', group: 'wind', value: (r, _n, u) => convWind(r?.wind, u.wind) },
  { key: 'gust', label: 'city.wind.gusts', group: 'wind', value: (r, _n, u) => convWind(r?.gust, u.wind) },
  { key: 'sunshine', label: 'city.day.sunshine', group: 'sun', value: (r) => ((r?.sunshine === null || r?.sunshine === undefined) ? null : Math.round(r.sunshine / 360) / 10) },
  { key: 'uv', label: 'city.day.uvMax', group: 'uv', value: (r) => r?.uv ?? null },
];

const GROUPS: TrendGroupDef[] = [
  { key: 'temp', title: 'dayView.temperature' },
  { key: 'rain', title: 'city.day.precipitation', bars: true },
  { key: 'snow', title: 'city.day.snowfall', bars: true },
  { key: 'wind', title: 'city.wind.title' },
  { key: 'sun', title: 'city.day.sunshine' },
  { key: 'uv', title: 'city.day.uvMax' },
];

const NO_DATES: string[] = [];
const COLORS = ['signal.4', 'signal.2', 'dark.2', 'signal.7', 'dark.4', 'dark.1'];
const COMPARE_COLORS = ['dark.2', 'dark.4', 'dark.1', 'dark.3', 'dark.2', 'dark.4'];
const LENGTHS = [30, 90, 365, 0];
const BACK_YEARS = [0, 1, 10, 30];

function lenLabel(len: number): string {
  if (len === 0) { return t('history.all'); }
  return len === 365 ? '1y' : `${String(len)}d`;
}

function windowsPromise(cached: boolean, missing: boolean, key: string, download: () => PromiseLike<void>): PromiseLike<void> {
  if (cached) { return lastSettled(key); }
  return missing ? download() : latest(key);
}

const shiftYears = (date: string, years: number) => (years === 0 ? date : `${String(Number(date.slice(0, 4)) - years)}${date.slice(4)}`);

function trendWindow({ len, custom, back, today, followedAt }: TrendRangeInput): TrendWindow {
  const days = len === 0 ? Math.max(1, Math.min(3650, daysBetween(followedAt, today) + 1)) : len;
  const from = custom ? custom.from : addDays(today, -(days - 1));
  const to = custom ? custom.to : today;
  const windows = back === 0 ? [{ from, to }] : [{ from, to }, { from: shiftYears(from, back), to: shiftYears(to, back) }];
  return { from, to, windows };
}

function trendNames(back: number, to: string): TrendNames {
  const yearA = to.slice(0, 4);
  const yearB = String(Number(yearA) - back);
  return {
    a: (attr) => (back === 0 ? t(attr.label) : `${t(attr.label)} ${yearA}`),
    b: (attr) => `${t(attr.label)} ${yearB}`,
  };
}

function trendRows({ range, back, attrs, names, log, normals, units }: TrendRowInput): Record<string, string | number | null>[] {
  const rows: Record<string, string | number | null>[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const row: Record<string, string | number | null> = { label: shortDate(d) };
    const dayB = shiftYears(d, back);
    for (const a of attrs) {
      row[names.a(a)] = a.value(log?.[d], normals?.[d.slice(5)] ?? null, units);
      if (back !== 0) { row[names.b(a)] = a.value(log?.[dayB], normals?.[dayB.slice(5)] ?? null, units); }
    }
    rows.push(row);
  }
  return rows;
}

function TrendControls({ range, onSheet }: TrendControlsProps): ReactElement {
  const { picked, len, custom, back, setLen, setBack, setRangeDraft } = useTrendsStore(useShallow((st) => ({
    picked: st.picked, len: st.len, custom: st.custom, back: st.back, setLen: st.setLen, setBack: st.setBack, setRangeDraft: st.setRangeDraft,
  })));
  const year = Number(range.to.slice(0, 4));
  return (
    <>
      <Box className="tab-row">
        <UnstyledButton onClick={() => { onSheet('attrs'); }}>{t('history.attributes')} · {picked.length}</UnstyledButton>
        <UnstyledButton aria-pressed={custom !== null} data-active={custom === null ? undefined : true}
          onClick={() => { setRangeDraft({ from: range.from, to: range.to }); onSheet('range'); }}>
          {custom === null ? t('history.custom') : `${shortDate(custom.from)} – ${shortDate(custom.to)}`}
        </UnstyledButton>
      </Box>

      <Box className="tab-row" role="tablist">
        {LENGTHS.map((d) => {
          const on = custom === null && d === len;
          return (
            <UnstyledButton key={d} type="button" role="tab" aria-selected={on} data-active={on || undefined}
              onClick={() => { setLen(d); }}>{lenLabel(d)}</UnstyledButton>
          );
        })}
      </Box>

      <Text fz={12} c="dimmed" pb={4}>{t('history.compare')}</Text>
      <Box className="tab-row" role="tablist">
        {BACK_YEARS.map((y) => (
          <UnstyledButton key={y} type="button" role="tab" aria-selected={y === back} data-active={y === back || undefined}
            onClick={() => { setBack(y); }}>{y === 0 ? t('history.off') : String(year - y)}</UnstyledButton>
        ))}
      </Box>
    </>
  );
}

function TrendCharts({ cityId, range, attrs, names, data, windUnit }: TrendChartsProps): ReactElement {
  const { back, download, retryFailed } = useTrendsStore(useShallow((st) => ({ back: st.back, download: st.download, retryFailed: st.retryFailed })));
  const error = download.error;
  const base = { dataKey: 'label', xAxisProps: { interval: Math.max(0, Math.ceil(data.length / 6) - 1) } };
  const unitSuffix: Record<TrendGroup, string> = { temp: '°', rain: ' mm', snow: ' cm', wind: ` ${windUnitLabel(windUnit)}`, sun: ' h', uv: '' };
  return (
    <>
      {download.status === 'loading' && <Text fz={12} c="dimmed" py={8} role="status">{t('history.loadingDays')}</Text>}
      {error !== null && error !== '' && (
        <Box py={8}>
          <Text fz={12} c="signal.3" role="status">{t('history.downloadFailed', { error })}</Text>
          <Button fullWidth mt={6} variant="outline" color="gray" onClick={() => void retryFailed(cityId, range.windows)}>
            {t('common.tryAgain')}
          </Button>
        </Box>
      )}
      {GROUPS.map((g) => {
        const mine = attrs.filter((a) => a.group === g.key);
        if (mine.length === 0) { return null; }
        return (
          <GroupChart key={g.key} id={`trend:${cityId}:${g.key}`} group={g} data={data} base={base} unit={unitSuffix[g.key]}
            series={mine.flatMap((a, i) => [
              { name: names.a(a), color: COLORS[i % COLORS.length] },
              ...(back === 0 ? [] : [{ name: names.b(a), color: COMPARE_COLORS[i % COMPARE_COLORS.length] }]),
            ])} />
        );
      })}
    </>
  );
}

export function Trends({ cityId, log, normals, today, followedAt, tempUnit, windUnit }: TrendsProps): ReactElement {
  const { picked, len, custom, back, setCustom, ensureWindows } = useTrendsStore(useShallow((st) => ({
    picked: st.picked, len: st.len, custom: st.custom, back: st.back, setCustom: st.setCustom, ensureWindows: st.ensureWindows,
  })));
  const [sheet, setSheet] = useState<TrendsSheet>(null);
  const range = trendWindow({ len, custom, back, today, followedAt });
  const attrs = ATTRS.filter((a) => picked.includes(a.key));
  const names = trendNames(back, range.to);
  const data = trendRows({ range, back, attrs, names, log, normals, units: { temp: tempUnit, wind: windUnit } });
  return (
    <Box px={20}>
      <Box className="kicker" style={{ paddingBottom: 8 }}>{t('history.trends')}</Box>
      <TrendControls range={range} onSheet={setSheet} />

      {attrs.length === 0 && <Text fz={13} c="dimmed" py={12}>{t('history.attrNone')}</Text>}

      <Suspense fallback={(
        <>
          <Text fz={12} c="dimmed" py={8} role="status">{t('history.loadingDays')}</Text>
          {GROUPS.filter((g) => attrs.some((a) => a.group === g.key)).map((g) => <ChartSk key={g.key} />)}
        </>
      )}>
        <TrendsFill cityId={cityId} windows={range.windows} ensureWindows={ensureWindows}>
          <TrendCharts cityId={cityId} range={range} attrs={attrs} names={names} data={data} windUnit={windUnit} />
        </TrendsFill>
      </Suspense>

      {sheet === 'attrs' && <AttrSheet onClose={() => { setSheet(null); }} />}
      {sheet === 'range' && (
        <RangeSheet max={today}
          onClose={() => { setSheet(null); }}
          onApply={(r) => { setCustom(r); setSheet(null); }} />
      )}
    </Box>
  );
}

function TrendsFill({ cityId, windows, ensureWindows, children }: TrendsFillProps) {
  const attempted = useTrendsStore((st) => st.attempted);
  const logged = useLogStore((st) => st.dates[cityId] ?? NO_DATES);
  const key = trendsKey(cityId, windows);
  const missing = windows.some((w) => hasGap(logged, w) && !attempted.includes(windowKey(cityId, w)));
  const cached = windows.some((w) => hasLogged(logged, w));
  const download = useEffectEvent(() => { void ensureWindows(cityId, windows); });
  useEffect(() => {
    if (cached && missing) { download(); }
  }, [cached, missing, key]);
  use(windowsPromise(cached, missing, key, () => ensureWindows(cityId, windows)));
  return <>{children}</>;
}

function GroupChart({ id, group, series, data, base, unit }: GroupChartProps) {
  const toggle = useSeriesToggle(`trend:${group.key}`);
  const shown = toggle.visible(series);
  const chart = (height: ChartHeight) => {
    const common = { ...base, h: height, unit, data, series: shown, withLegend: false };
    return (
      <>
        {(group.bars === true)
          ? <BarChart {...common} />
          : <LineChart {...common} withDots={data.length < 15} connectNulls={false} />}
        {toggle.legend(series)}
      </>
    );
  };
  return (
    <Box pt={12}>
      <Group justify="space-between" wrap="nowrap" gap={8}>
        <Text fz={12} c="dimmed">{t(group.title)}</Text>
        <ExpandButton id={id} />
      </Group>
      {chart(INLINE_HEIGHT)}
      <FullscreenChart id={id} title={t(group.title)} render={chart} />
    </Box>
  );
}

function AttrSheet({ onClose }: SheetCloseProps) {
  const picked = useTrendsStore((st) => st.picked);
  const toggle = useTrendsStore((st) => st.togglePicked);
  return (
    <Modal opened onClose={onClose} fullScreen title={t('history.attrTitle')} closeButtonProps={{ size: 44, iconSize: 20, 'aria-label': t('common.close') }}>
      {GROUPS.map((g) => {
        const mine = ATTRS.filter((a) => a.group === g.key);
        return (
          <Box key={g.key} px={20}>
            <Box className="kicker">{t(g.title)}</Box>
            {mine.map((a) => (
              <Checkbox key={a.key} className="row" py={14} radius={0} size="md"
                checked={picked.includes(a.key)} onChange={() => { toggle(a.key); }}
                label={<Text fz={15} fw={600}>{t(a.label)}</Text>} />
            ))}
          </Box>
        );
      })}
    </Modal>
  );
}

function RangeSheet({ max, onApply, onClose }: RangeSheetProps) {
  const { from: a, to: b } = useTrendsStore((st) => st.rangeDraft);
  const setDraft = useTrendsStore((st) => st.setRangeDraft);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b) && a <= b && a >= '1940-01-01' && b <= max;
  const span = valid ? daysBetween(a, b) + 1 : 0;
  return (
    <Drawer opened onClose={onClose} title={t('history.custom')} closeButtonProps={{ size: 44, iconSize: 20, 'aria-label': t('common.close') }}>
      <Box className="stat-grid">
        <TextInput type="date" label={t('history.from')} min="1940-01-01" max={max} value={a} onChange={(e) => { setDraft({ from: e.currentTarget.value }); }} />
        <TextInput type="date" label={t('history.to')} min="1940-01-01" max={max} value={b} onChange={(e) => { setDraft({ to: e.currentTarget.value }); }} />
      </Box>
      <Text fz={12} c="dimmed" mt={8}>{t('history.addNote')}</Text>
      <Button fullWidth mt={12} disabled={!valid} onClick={() => { onApply({ from: a, to: b }); }}>
        {valid ? t('common.days', { count: span }) : t('history.custom')}
      </Button>
    </Drawer>
  );
}
