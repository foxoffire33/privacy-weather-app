import { Suspense, use, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Box, Button, Checkbox, Drawer, Modal, Text, TextInput, UnstyledButton } from '@mantine/core';
import { BarChart, LineChart } from '@mantine/charts';

import { t } from '../../i18n';
import { convTemp, convWind, shortDate, windUnitLabel } from '../../lib/format';
import { addDays, daysBetween } from '../../storesV2';
import type { TempUnit } from '../../storesV2';
import { ChartSk } from '../Skeletons';
import { useSeriesToggle } from '../charts/SeriesToggle';
import { hasGap, trendsKey, useTrendsStore, windowKey } from '../../store/trendsStore';
import { lastSettled } from '../../storesV2';
import type { GroupChartProps, RangeSheetProps, SheetCloseProps, TrendAttr, TrendGroup, TrendGroupDef, TrendsFillProps, TrendsProps, TrendsSheet } from '../../types';

const T = (c: number | null | undefined, unit: TempUnit) => convTemp(c, unit);

export const ATTRS: TrendAttr[] = [
  { key: 'hi', label: 'city.high', group: 'temp', value: (r, _n, u) => T(r?.hi, u.temp) },
  { key: 'lo', label: 'city.low', group: 'temp', value: (r, _n, u) => T(r?.lo, u.temp) },
  { key: 'normal', label: 'history.normal', group: 'temp', value: (_r, n, u) => T(n, u.temp) },
  { key: 'feelsHi', label: 'history.attrFeelsHi', group: 'temp', value: (r, _n, u) => T(r?.feelsHi, u.temp) },
  { key: 'feelsLo', label: 'history.attrFeelsLo', group: 'temp', value: (r, _n, u) => T(r?.feelsLo, u.temp) },
  { key: 'delta', label: 'history.metricDelta', group: 'temp', value: (r, n, u) => (n == null || r?.hi == null ? null : Math.round((u.temp === 'F' ? (r.hi - n) * 9 / 5 : r.hi - n) * 10) / 10) },
  { key: 'mm', label: 'city.day.precipitation', group: 'rain', value: (r) => r?.mm ?? null },
  { key: 'snow', label: 'city.day.snowfall', group: 'snow', value: (r) => r?.snow ?? null },
  { key: 'wind', label: 'city.wind.title', group: 'wind', value: (r, _n, u) => convWind(r?.wind, u.wind) },
  { key: 'gust', label: 'city.wind.gusts', group: 'wind', value: (r, _n, u) => convWind(r?.gust, u.wind) },
  { key: 'sunshine', label: 'city.day.sunshine', group: 'sun', value: (r) => (r?.sunshine == null ? null : Math.round(r.sunshine / 360) / 10) },
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

const COLORS = ['signal.4', 'signal.2', 'dark.2', 'signal.7', 'dark.4', 'dark.1'];
const COMPARE_COLORS = ['dark.2', 'dark.4', 'dark.1', 'dark.3', 'dark.2', 'dark.4'];
const LENGTHS = [30, 90, 365, 0];
const BACK_YEARS = [0, 1, 10, 30];

export function Trends({ cityId, log, normals, today, followedAt, tempUnit, windUnit }: TrendsProps) {
  const { picked, len, custom, back, download, setLen, setCustom, setBack, setRangeDraft, ensureWindows } = useTrendsStore(useShallow((st) => ({
    picked: st.picked, len: st.len, custom: st.custom, back: st.back, download: st.download,
    setLen: st.setLen, setCustom: st.setCustom, setBack: st.setBack, setRangeDraft: st.setRangeDraft, ensureWindows: st.ensureWindows,
  })));
  const [sheet, setSheet] = useState<TrendsSheet>(null);
  const error = download.error;
  const days = len || Math.max(1, Math.min(3650, daysBetween(followedAt, today) + 1));
  const from = custom ? custom.from : addDays(today, -(days - 1));
  const to = custom ? custom.to : today;
  const shift = (date: string, years: number) => (years ? `${+date.slice(0, 4) - years}${date.slice(4)}` : date);
  const windows = back ? [{ from, to }, { from: shift(from, back), to: shift(to, back) }] : [{ from, to }];
  const units = { temp: tempUnit, wind: windUnit };
  const attrs = ATTRS.filter((a) => picked.includes(a.key));
  const yearA = to.slice(0, 4);
  const yearB = back ? String(+to.slice(0, 4) - back) : '';
  const nameA = (a: TrendAttr) => (back ? `${t(a.label)} ${yearA}` : t(a.label));
  const nameB = (a: TrendAttr) => `${t(a.label)} ${yearB}`;
  const data: Record<string, string | number | null>[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const row: Record<string, string | number | null> = { label: shortDate(d) };
    const dayB = back ? shift(d, back) : '';
    for (const a of attrs) {
      row[nameA(a)] = a.value(log?.[d], normals?.[d.slice(5)] ?? null, units);
      if (back) row[nameB(a)] = a.value(log?.[dayB], normals?.[dayB.slice(5)] ?? null, units);
    }
    data.push(row);
  }
  const base = { dataKey: 'label', xAxisProps: { interval: Math.max(0, Math.ceil(data.length / 6) - 1) } };
  const unitOf = (g: TrendGroup) => (g === 'temp' ? '°' : g === 'rain' ? ' mm' : g === 'snow' ? ' cm' : g === 'wind' ? ` ${windUnitLabel(windUnit)}` : g === 'sun' ? ' h' : '');
  const rangeLabel = custom
    ? `${shortDate(custom.from)} – ${shortDate(custom.to)}`
    : len ? (len === 365 ? '1y' : `${len}d`) : t('history.all');
  return (
    <Box px={20}>
      <Box className="kicker" style={{ paddingBottom: 8 }}>{t('history.trends')}</Box>

      <Box className="tab-row">
        <UnstyledButton onClick={() => setSheet('attrs')}>{t('history.attributes')} · {picked.length}</UnstyledButton>
        <UnstyledButton aria-pressed={!!custom} data-active={custom ? true : undefined}
          onClick={() => { setRangeDraft({ from, to }); setSheet('range'); }}>{custom ? rangeLabel : t('history.custom')}</UnstyledButton>
      </Box>

      <Box className="tab-row" role="tablist">
        {LENGTHS.map((d) => {
          const on = !custom && d === len;
          return (
            <UnstyledButton key={d} type="button" role="tab" aria-selected={on} data-active={on || undefined}
              onClick={() => setLen(d)}>{d ? (d === 365 ? '1y' : `${d}d`) : t('history.all')}</UnstyledButton>
          );
        })}
      </Box>

      <Text fz={12} c="dimmed" pb={4}>{t('history.compare')}</Text>
      <Box className="tab-row" role="tablist">
        {BACK_YEARS.map((y) => (
          <UnstyledButton key={y} type="button" role="tab" aria-selected={y === back} data-active={y === back || undefined}
            onClick={() => setBack(y)}>{y ? String(+to.slice(0, 4) - y) : t('history.off')}</UnstyledButton>
        ))}
      </Box>

      {!attrs.length && <Text fz={13} c="dimmed" py={12}>{t('history.attrNone')}</Text>}

      <Suspense fallback={(
        <>
          <Text fz={12} c="dimmed" py={8} role="status">{t('history.loadingDays')}</Text>
          {GROUPS.filter((g) => attrs.some((a) => a.group === g.key)).map((g) => <ChartSk key={g.key} />)}
        </>
      )}>
        <TrendsFill cityId={cityId} windows={windows} ensureWindows={ensureWindows}>
          {error && <Text fz={12} c="signal.3" py={8} role="status">{t('history.downloadFailed', { error })}</Text>}
          {GROUPS.map((g) => {
            const mine = attrs.filter((a) => a.group === g.key);
            if (!mine.length) return null;
            return (
              <GroupChart key={g.key} group={g} data={data} base={base} unit={unitOf(g.key)}
                series={mine.flatMap((a, i) => [
                  { name: nameA(a), color: COLORS[i % COLORS.length] },
                  ...(back ? [{ name: nameB(a), color: COMPARE_COLORS[i % COMPARE_COLORS.length] }] : []),
                ])} />
            );
          })}
        </TrendsFill>
      </Suspense>

      {sheet === 'attrs' && <AttrSheet onClose={() => setSheet(null)} />}
      {sheet === 'range' && (
        <RangeSheet max={today}
          onClose={() => setSheet(null)}
          onApply={(r) => { setCustom(r); setSheet(null); }} />
      )}
    </Box>
  );
}

function TrendsFill({ cityId, windows, ensureWindows, children }: TrendsFillProps) {
  const attempted = useTrendsStore((st) => st.attempted);
  const missing = windows.some((w) => hasGap(cityId, w) && !attempted.includes(windowKey(cityId, w)));
  use(missing ? ensureWindows(cityId, windows) : lastSettled(trendsKey(cityId, windows)));
  return <>{children}</>;
}

function GroupChart({ group, series, data, base, unit }: GroupChartProps) {
  const toggle = useSeriesToggle(`trend:${group.key}`);
  const shown = toggle.visible(series);
  const common = { ...base, h: 180, unit, data, series: shown, withLegend: false };
  return (
    <Box pt={12}>
      <Text fz={12} c="dimmed" pb={4}>{t(group.title)}</Text>
      {group.bars
        ? <BarChart {...common} />
        : <LineChart {...common} withDots={data.length < 15} connectNulls={false} />}
      {toggle.legend(series)}
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
                checked={picked.includes(a.key)} onChange={() => toggle(a.key)}
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
        <TextInput type="date" label={t('history.from')} min="1940-01-01" max={max} value={a} onChange={(e) => setDraft({ from: e.currentTarget.value })} />
        <TextInput type="date" label={t('history.to')} min="1940-01-01" max={max} value={b} onChange={(e) => setDraft({ to: e.currentTarget.value })} />
      </Box>
      <Text fz={12} c="dimmed" mt={8}>{t('history.addNote')}</Text>
      <Button fullWidth mt={12} disabled={!valid} onClick={() => onApply({ from: a, to: b })}>
        {valid ? t('common.days', { count: span }) : t('history.custom')}
      </Button>
    </Drawer>
  );
}
