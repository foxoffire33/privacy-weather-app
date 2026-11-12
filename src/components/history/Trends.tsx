import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Button, Checkbox, Group, Loader, Paper, Text, TextInput } from '@mantine/core';
import { BarChart, LineChart } from '@mantine/charts';

import { t, type MessageKey } from '../../i18n';
import { addDays, convTemp, convWind, daysBetween, shortDate, windUnitLabel } from '../../lib/format';
import type { DayRecord, TempUnit, WindUnit } from '../../types';
import { Icon } from '../Icon';

// Everything a logged day holds, as chart attributes. Attributes sharing a unit share a chart;
// each group becomes its own chart, so nothing is drawn on a scale it does not belong to.
type Group = 'temp' | 'rain' | 'snow' | 'wind' | 'sun' | 'uv';
interface Attr {
  key: string;
  label: MessageKey;
  group: Group;
  value: (r: DayRecord | undefined, normal: number | null, units: { temp: TempUnit; wind: WindUnit }) => number | null;
}

const T = (c: number | null | undefined, unit: TempUnit) => convTemp(c, unit);

export const ATTRS: Attr[] = [
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

const GROUPS: { key: Group; title: MessageKey; bars?: boolean }[] = [
  { key: 'temp', title: 'dayView.temperature' },
  { key: 'rain', title: 'city.day.precipitation', bars: true },
  { key: 'snow', title: 'city.day.snowfall', bars: true },
  { key: 'wind', title: 'city.wind.title' },
  { key: 'sun', title: 'city.day.sunshine' },
  { key: 'uv', title: 'city.day.uvMax' },
];

const DEFAULT_ATTRS = ['hi', 'lo', 'normal'];
const COLORS = ['signal.4', 'signal.2', 'dark.2', 'signal.7', 'dark.4', 'dark.1'];
const COMPARE_COLORS = ['dark.2', 'dark.4', 'dark.1', 'dark.3', 'dark.2', 'dark.4'];
const LENGTHS = [30, 90, 365, 0];
const BACK_YEARS = [0, 1, 10, 30];

/**
 * Trends: the logged days of a period, drawn attribute by attribute, optionally against the
 * same period in an earlier year. Days either period is missing are downloaded from the
 * archive into the log, so comparing also fills the history.
 */
export function Trends({ cityId, log, normals, today, followedAt, tempUnit, windUnit, importRange }: {
  cityId: string;
  log?: Record<string, DayRecord>;
  normals?: Record<string, number>;
  today: string;
  followedAt: string;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  importRange: (id: string, start: string, end: string) => Promise<{ added: number; updated: number; kept: number }>;
}) {
  const [picked, setPicked] = useState<string[]>(DEFAULT_ATTRS);
  const [len, setLen] = useState<number>(30);
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [back, setBack] = useState(0);
  const [sheet, setSheet] = useState<'attrs' | 'range' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef<Set<string>>(new Set());

  const days = len || Math.max(1, Math.min(3650, daysBetween(followedAt, today) + 1));
  const from = custom ? custom.from : addDays(today, -(days - 1));
  const to = custom ? custom.to : today;
  const shift = (date: string, years: number) => (years ? `${+date.slice(0, 4) - years}${date.slice(4)}` : date);

  // Fill whatever the chosen periods are missing, once per period.
  useEffect(() => {
    const windows = [{ from, to }];
    if (back) windows.push({ from: shift(from, back), to: shift(to, back) });
    const wanted = windows
      .filter((w) => {
        if (w.from > w.to) return false;
        for (let d = w.from; d <= w.to; d = addDays(d, 1)) if (!log?.[d]) return true;
        return false;
      })
      .filter((w) => !fetched.current.has(`${cityId}:${w.from}:${w.to}`));
    if (!wanted.length) return;
    let active = true;
    setBusy(true);
    setError(null);
    void (async () => {
      for (const w of wanted) {
        fetched.current.add(`${cityId}:${w.from}:${w.to}`);
        try {
          await importRange(cityId, w.from, w.to);
        } catch (e) {
          if (active) setError((e as Error).message);
        }
      }
      if (active) setBusy(false);
    })();
    return () => { active = false; };
  }, [cityId, from, to, back]); // eslint-disable-line react-hooks/exhaustive-deps

  const units = { temp: tempUnit, wind: windUnit };
  const attrs = ATTRS.filter((a) => picked.includes(a.key));
  const yearA = to.slice(0, 4);
  const yearB = back ? String(+to.slice(0, 4) - back) : '';

  const nameA = (a: Attr) => (back ? `${t(a.label)} ${yearA}` : t(a.label));
  const nameB = (a: Attr) => `${t(a.label)} ${yearB}`;

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
  const unitOf = (g: Group) => (g === 'temp' ? '°' : g === 'rain' ? ' mm' : g === 'snow' ? ' cm' : g === 'wind' ? ` ${windUnitLabel(windUnit)}` : g === 'sun' ? ' h' : '');

  const rangeLabel = custom
    ? `${shortDate(custom.from)} – ${shortDate(custom.to)}`
    : len ? (len === 365 ? '1y' : `${len}d`) : t('history.all');

  return (
    <Box px={20}>
      <div className="kicker" style={{ paddingBottom: 8 }}>{t('history.trends')}</div>

      <div className="tab-row">
        <button type="button" onClick={() => setSheet('attrs')}>{t('history.attributes')} · {picked.length}</button>
        <button type="button" aria-pressed={!!custom} data-active={custom ? true : undefined}
          onClick={() => setSheet('range')}>{custom ? rangeLabel : t('history.custom')}</button>
      </div>

      <div className="tab-row" role="tablist">
        {LENGTHS.map((d) => {
          const on = !custom && d === len;
          return (
            <button key={d} type="button" role="tab" aria-selected={on} data-active={on || undefined}
              onClick={() => { setCustom(null); setLen(d); }}>{d ? (d === 365 ? '1y' : `${d}d`) : t('history.all')}</button>
          );
        })}
      </div>

      <Text fz={12} c="dimmed" pb={4}>{t('history.compare')}</Text>
      <div className="tab-row" role="tablist">
        {BACK_YEARS.map((y) => (
          <button key={y} type="button" role="tab" aria-selected={y === back} data-active={y === back || undefined}
            onClick={() => setBack(y)}>{y ? String(+to.slice(0, 4) - y) : t('history.off')}</button>
        ))}
      </div>

      {busy && (
        <Group gap={8} py={8} wrap="nowrap" role="status">
          <Loader size="xs" />
          <Text fz={12} c="dimmed">{t('history.loadingDays')}</Text>
        </Group>
      )}
      {error && <Text fz={12} c="signal.3" py={8} role="status">{t('history.downloadFailed', { error })}</Text>}
      {!attrs.length && <Text fz={13} c="dimmed" py={12}>{t('history.attrNone')}</Text>}

      {GROUPS.map((g) => {
        const mine = attrs.filter((a) => a.group === g.key);
        if (!mine.length) return null;
        const series = mine.flatMap((a, i) => [
          { name: nameA(a), color: COLORS[i % COLORS.length] },
          ...(back ? [{ name: nameB(a), color: COMPARE_COLORS[i % COMPARE_COLORS.length] }] : []),
        ]);
        // The legend wraps at roughly three entries a line; reserve a line's height for each
        // so it never runs into whatever follows the chart.
        const lines = Math.ceil(series.length / 3);
        const common = {
          ...base, unit: unitOf(g.key), data, series, withLegend: true,
          h: 180 + (lines - 1) * 24,
          legendProps: { verticalAlign: 'bottom' as const, height: lines * 24 + 4 },
        };
        return (
          <Box key={g.key} pt={12}>
            <Text fz={12} c="dimmed" pb={4}>{t(g.title)}</Text>
            {g.bars
              ? <BarChart {...common} />
              : <LineChart {...common} withDots={data.length < 15} connectNulls={false} />}
          </Box>
        );
      })}

      {sheet === 'attrs' && (
        <AttrSheet picked={picked} onChange={setPicked} onClose={() => setSheet(null)} />
      )}
      {sheet === 'range' && (
        <RangeSheet from={from} to={to} max={today}
          onClose={() => setSheet(null)}
          onApply={(r) => { setCustom(r); setSheet(null); }} />
      )}
    </Box>
  );
}

// Full-screen list of every attribute, each with a checkbox before its name.
function AttrSheet({ picked, onChange, onClose }: { picked: string[]; onChange: (keys: string[]) => void; onClose: () => void }) {
  const toggle = (key: string) => onChange(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]);
  return (
    <div className="sheet" role="dialog" aria-label={t('history.attrTitle')}>
      <Group justify="space-between" px={14} py={8} wrap="nowrap" className="sheet-head">
        <Text fz={16} fw={800} pl={6}>{t('history.attrTitle')}</Text>
        <ActionIcon size={44} aria-label={t('common.close')} onClick={onClose}><Icon name="x" size={22} /></ActionIcon>
      </Group>
      <div className="sheet-body">
        {GROUPS.map((g) => {
          const mine = ATTRS.filter((a) => a.group === g.key);
          return (
            <Box key={g.key} px={20}>
              <div className="kicker">{t(g.title)}</div>
              {mine.map((a) => (
                <Checkbox key={a.key} className="row" py={14} radius={0} size="md"
                  checked={picked.includes(a.key)} onChange={() => toggle(a.key)}
                  label={<Text fz={15} fw={600}>{t(a.label)}</Text>} />
              ))}
            </Box>
          );
        })}
      </div>
    </div>
  );
}

// From/to pickers for a period of your own.
function RangeSheet({ from, to, max, onApply, onClose }: {
  from: string; to: string; max: string;
  onApply: (r: { from: string; to: string }) => void;
  onClose: () => void;
}) {
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b) && a <= b && a >= '1940-01-01' && b <= max;
  const span = valid ? daysBetween(a, b) + 1 : 0;
  return (
    <Box className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Paper className="glass" w="100%" maw={420} p={16} style={{ textTransform: 'none', letterSpacing: 0 }}
        role="dialog" aria-label={t('history.custom')}>
        <Group justify="space-between" mb={8}>
          <Text fz={16} fw={800}>{t('history.custom')}</Text>
          <ActionIcon size={44} aria-label={t('common.close')} onClick={onClose}><Icon name="x" size={20} /></ActionIcon>
        </Group>
        <div className="stat-grid">
          <TextInput type="date" label={t('history.from')} min="1940-01-01" max={max} value={a} onChange={(e) => setA(e.currentTarget.value)} />
          <TextInput type="date" label={t('history.to')} min="1940-01-01" max={max} value={b} onChange={(e) => setB(e.currentTarget.value)} />
        </div>
        <Text fz={12} c="dimmed" mt={8}>{t('history.addNote')}</Text>
        <Button fullWidth mt={12} disabled={!valid} onClick={() => onApply({ from: a, to: b })}>
          {valid ? t('common.days', { count: span }) : t('history.custom')}
        </Button>
      </Paper>
    </Box>
  );
}
