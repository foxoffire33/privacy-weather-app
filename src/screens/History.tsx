import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Group, Loader, Paper, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { BarChart, LineChart } from '@mantine/charts';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../store';
import type { DayRecord, TempUnit } from '../types';
import { conditionLabel } from '../lib/weatherCodes';
import { addDays, convTemp, daysBetween, downloadFile, fmtDelta, fmtTemp, fmtWind, longDate, shortDate, todayISO } from '../lib/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';
import { Sk } from '../components/Skeletons';
import { SwipeRow } from '../components/SwipeRow';
import { t } from '../i18n';

export function History({ cityId }: { cityId: string }) {
  const s = useWeatherStore(useShallow((st) => {
    const entry = st.forecasts[cityId];
    const today = entry ? entry.data.daily.time[entry.pastDays] : todayISO();
    return {
      city: st.cities.find((c) => c.id === cityId),
      log: st.history[cityId],
      normals: st.normals[cityId],
      today,
      years: st.thisDay[`${cityId}:${today.slice(5)}`],
      draft: st.lookupDraft,
      lookup: st.lookups[`${cityId}:${st.lookupDraft}`],
      tempUnit: st.settings.tempUnit,
      windUnit: st.settings.windUnit,
      loadThisDay: st.loadThisDay,
      setLookupDraft: st.setLookupDraft,
      lookupDate: st.lookupDate,
      deleteLogDay: st.deleteLogDay,
      importRange: st.importRange,
      navigate: st.navigate,
      goHome: st.goHome,
      range: st.historyRange,
      setRange: st.setHistoryRange,
      cityIndex: st.cities.findIndex((c) => c.id === cityId),
      back: st.back,
    };
  }));
  const { loadThisDay, today, lookupDate, draft } = s;
  useEffect(() => { void loadThisDay(cityId, today); }, [cityId, today, loadThisDay]);
  // A complete, in-range date is looked up as soon as it is entered (debounced while the year is still being typed).
  const maxLookupDate = addDays(today, -5); // archive lags ~5 days
  const validDraft = /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft >= '1940-01-01' && draft <= maxLookupDate;
  const lookedUp = !!s.lookup;
  const [swiped, setSwiped] = useState<string | null>(null);
  useEffect(() => {
    if (!validDraft || lookedUp) return;
    const t = window.setTimeout(() => void lookupDate(cityId, draft), 350);
    return () => window.clearTimeout(t);
  }, [validDraft, lookedUp, cityId, draft, lookupDate]);

  if (!s.city) return <div className="screen"><ScreenHeader /><Text px={20}>{t('common.noLongerFollowed')}</Text></div>;

  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const rows = Object.values(s.log ?? {}).sort((a, b) => b.date.localeCompare(a.date));
  const maxLookup = addDays(today, -5); // archive lags ~5 days

  const open = (date: string) => (date === today ? s.goHome(s.cityIndex) : s.navigate({ name: 'day', cityId, date }));

  const exportCsv = () => {
    const head = 'date,max_c,min_c,feels_max_c,feels_min_c,precip_mm,snow_cm,wind_max_kmh,gust_max_kmh,sunshine_s,uv_max,weather_code,source';
    const body = rows.map((r) => [r.date, r.hi, r.lo, r.feelsHi, r.feelsLo, r.mm, r.snow, r.wind, r.gust, r.sunshine, r.uv, r.code, r.source].map((x) => x ?? '').join(',')).join('\n');
    downloadFile(`${s.city!.name.toLowerCase().replace(/\s+/g, '-')}-history.csv`, `${head}\n${body}`, 'text/csv');
  };

  return (
    <div className="screen">
      <ScreenHeader right={
        <ActionIcon aria-label={t('history.export')} disabled={!rows.length} onClick={exportCsv}><Icon name="download" size={20} /></ActionIcon>
      } />
      <Text px={20} fz={13} c="dimmed">{s.city.name}</Text>
      <Title className="display display-sm" style={{ whiteSpace: 'pre-line' }}>{t('history.title')}</Title>

      <Paper className="glass" mx={12}>
        <div className="archive-grid">
          {(s.years ?? [0, 1, 2, 3].map(() => null)).map((y, i) => (
            <UnstyledButton key={y?.year ?? i} py={10} pl={12} style={{ borderRight: '1px solid rgba(255,255,255,.1)' }}
              disabled={!y || y.error} onClick={() => y && open(`${y.year}${today.slice(4)}`)}>
              {y ? (
                <>
                  <Text fz={12} c="dimmed">{y.year}</Text>
                  <Text fz={22} fw={800}>{y.error ? '–' : `${T(y.hi)}°`}</Text>
                  <Text fz={12} c="dimmed">{y.error ? t('history.noData') : `${T(y.lo)}° · ${(y.mm ?? 0).toFixed(1)}mm`}</Text>
                </>
              ) : (
                <>
                  <Sk w={30} h={11} mt={3} />
                  <Sk w={44} h={26} mt={5} />
                  <Sk w={56} h={11} mt={5} />
                </>
              )}
            </UnstyledButton>
          ))}
        </div>
        <Box p={12} style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <TextInput type="date" label={t('history.lookup')}
            min="1940-01-01" max={maxLookup} value={s.draft}
            onChange={(e) => s.setLookupDraft(e.currentTarget.value)} />
          {validDraft && (
            <UnstyledButton mt={12} w="100%" disabled={!s.lookup || !!s.lookup.loading || !!s.lookup.error} onClick={() => {
                // A looked-up date is saved to the log before it opens.
                void s.importRange(cityId, s.draft, s.draft).catch(() => undefined);
                open(s.draft);
              }}
              style={{ border: '2px solid var(--rule)', display: 'block' }}>
              {!s.lookup || s.lookup.loading ? (
                <Box p={14}><Sk w={140} h={12} /><Sk w={120} h={40} mt={10} /><Sk h={14} mt={10} /></Box>
              ) : s.lookup.error ? (
                <Box p={14}><Text fz={13} c="signal.3">{s.lookup.error}</Text></Box>
              ) : (
                <>
                  <Group className="accent-field" justify="space-between" px={14} py={8} wrap="nowrap">
                    <Text fz={12} fw={800} tt="uppercase" style={{ letterSpacing: '.06em' }}>{longDate(s.draft)}</Text>
                    <Icon name="arrow" size={16} />
                  </Group>
                  <Box p={14}>
                    <Group justify="space-between" align="flex-end" wrap="nowrap">
                      <Text fz={16} fw={800}>{conditionLabel(s.lookup.code)}</Text>
                      <Text fz={40} fw={800} lh={1}>{T(s.lookup.hi)}°<Text span fz={20} c="dimmed" fw={600}> / {T(s.lookup.lo)}°</Text></Text>
                    </Group>
                    <div className="stat-grid" style={{ marginTop: 12 }}>
                      <Box><Text fz={12} tt="uppercase" c="dimmed">{t('history.rain')}</Text><Text fz={16} fw={800}>{(s.lookup.mm ?? 0).toFixed(1)} mm</Text></Box>
                      <Box><Text fz={12} tt="uppercase" c="dimmed">{t('history.maxWind')}</Text><Text fz={16} fw={800}>{fmtWind(s.lookup.wind, s.windUnit)}</Text></Box>
                    </div>
                  </Box>
                </>
              )}
            </UnstyledButton>
          )}
        </Box>
      </Paper>

      {rows.length > 1 && (
        <Trends cityId={cityId} log={s.log} normals={s.normals} today={today} followedAt={s.city.followedAt}
          tempUnit={s.tempUnit} importRange={s.importRange} />
      )}

      <Box px={20} pb={24}>
        <Group justify="space-between" className="kicker" wrap="nowrap">
          <span>{t('history.yourLog', { days: t('common.days', { count: rows.length }) })}</span>
          <ImportRange cityId={cityId} maxDate={maxLookup} importRange={s.importRange} />
        </Group>
        {rows.length === 0 && <Text py={12} fz={13} c="dimmed">{t('history.empty')}</Text>}
        {rows.map((r) => {
          const normal = s.normals?.[r.date.slice(5)];
          const delta = normal != null && r.hi != null ? fmtDelta(r.hi - normal, s.tempUnit) : null;
          return (
            <SwipeRow key={r.date} label={longDate(r.date)} disabled={r.date === today}
              open={swiped === r.date} onOpenChange={(o) => setSwiped(o ? r.date : null)}
              onDelete={() => { s.deleteLogDay(cityId, r.date); setSwiped(null); }}>
            <UnstyledButton className="log-row row" py={10} w="100%" onClick={() => open(r.date)}>
              <Text fz={14} fw={800}>{r.date === today ? t('common.today') : shortDate(r.date)}</Text>
              <Text fz={13} c="dimmed" truncate>{t('history.rowDetail', { cond: conditionLabel(r.code), mm: (r.mm || 0).toFixed(1) })}{r.feelsHi != null ? t('history.rowFeels', { t: T(r.feelsHi) }) : ''}</Text>
              <span>{r.source === 'filled' && <Badge variant="outline" color="gray" size="xs">{t('history.filled')}</Badge>}</span>
              <Text fz={20} fw={800} ta="right">{T(r.hi)}°</Text>
              <Text fz={12} ta="right" c={delta?.startsWith('+') ? 'signal.3' : 'dimmed'}>{delta ?? ''}</Text>
            </UnstyledButton>
            </SwipeRow>
          );
        })}
      </Box>
    </div>
  );
}

// Download a range of past days from the archive into the log.
function ImportRange({ cityId, maxDate, importRange }: {
  cityId: string;
  maxDate: string;
  importRange: (id: string, start: string, end: string) => Promise<{ added: number; updated: number; kept: number }>;
}) {
  const [show, setShow] = useState(false);
  const [from, setFrom] = useState(() => addDays(maxDate, -29));
  const [to, setTo] = useState(maxDate);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const days = from && to ? daysBetween(from, to) + 1 : 0;
  const tooLong = days > 3660;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)
    && from >= '1940-01-01' && to <= maxDate && days > 0 && !tooLong;

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const c = await importRange(cityId, from, to);
      setMsg(t(c.kept ? 'history.addedKept' : 'history.added', { count: c.added, updated: c.updated, kept: c.kept }));
    } catch (e) {
      setMsg(t('history.downloadFailed', { error: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  if (!show) {
    return (
      <button type="button" className="tab-button" onClick={() => setShow(true)}>
        <Icon name="plus" size={14} />{t('history.addDates')}
      </button>
    );
  }
  return (
    <Box style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) setShow(false); }}>
      <Paper className="glass" w="100%" maw={420} p={16} style={{ textTransform: 'none', letterSpacing: 0 }}
        role="dialog" aria-label={t('history.addTitle')}>
        <Group justify="space-between" mb={8}>
          <Text fz={16} fw={800}>{t('history.addTitle')}</Text>
          <ActionIcon aria-label={t('common.close')} onClick={() => setShow(false)} disabled={busy}><Icon name="x" size={18} /></ActionIcon>
        </Group>
        <div className="stat-grid">
          <TextInput type="date" label={t('history.from')} min="1940-01-01" max={maxDate} value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
          <TextInput type="date" label={t('history.to')} min="1940-01-01" max={maxDate} value={to} onChange={(e) => setTo(e.currentTarget.value)} />
        </div>
        <Text fz={12} c="dimmed" mt={8}>
          {t('history.addNote')}
        </Text>
        {tooLong && <Text fz={12} c="signal.3" mt={6}>{t('history.tooLong')}</Text>}
        <Button fullWidth mt={12} loading={busy} disabled={!valid} onClick={() => void run()}>
          {valid ? t('history.downloadDays', { count: days }) : t('history.download')}
        </Button>
        {msg && <Text fz={13} mt={10} role="status">{msg}</Text>}
      </Paper>
    </Box>
  );
}

const METRICS = [
  { value: 'temp', label: 'history.metricTemp' },
  { value: 'delta', label: 'history.metricDelta' },
  { value: 'rain', label: 'city.day.precipitation' },
] as const;
const LENGTHS = [30, 90, 365, 0];
const BACK_YEARS = [0, 1, 10, 30];

// Trends: one metric at a time over a chosen period, optionally against the same period in an
// earlier year. Days missing from the log for either period are downloaded from the archive and
// added to the log, so comparing also fills the history.
function Trends({ cityId, log, normals, today, followedAt, tempUnit, importRange }: {
  cityId: string;
  log?: Record<string, DayRecord>;
  normals?: Record<string, number>;
  today: string;
  followedAt: string;
  tempUnit: TempUnit;
  importRange: (id: string, start: string, end: string) => Promise<{ added: number; updated: number; kept: number }>;
}) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]['value']>('temp');
  const [len, setLen] = useState(90);
  const [back, setBack] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef<Set<string>>(new Set());

  const days = len || Math.max(1, Math.min(3650, daysBetween(followedAt, today) + 1));
  const first = addDays(today, -(days - 1));
  const shift = (date: string, years: number) => (years ? `${+date.slice(0, 4) - years}${date.slice(4)}` : date);
  const maxArchive = addDays(today, -5); // the archive lags about 5 days

  // Fill whatever the selected periods are missing, once per period.
  useEffect(() => {
    const windows = [{ from: first, to: today }];
    if (back) windows.push({ from: shift(first, back), to: shift(today, back) });
    const wanted = windows
      .map(({ from, to }) => ({ from, to: to > maxArchive ? maxArchive : to }))
      .filter(({ from, to }) => {
        if (from > to) return false;
        for (let d = from; d <= to; d = addDays(d, 1)) if (!log?.[d]) return true;
        return false;
      })
      .filter(({ from, to }) => !fetched.current.has(`${cityId}:${from}:${to}`));
    if (!wanted.length) return;
    let active = true;
    setBusy(true);
    setError(null);
    void (async () => {
      for (const { from, to } of wanted) {
        fetched.current.add(`${cityId}:${from}:${to}`);
        try {
          await importRange(cityId, from, to);
        } catch (e) {
          if (active) setError((e as Error).message);
        }
      }
      if (active) setBusy(false);
    })();
    return () => { active = false; };
  }, [cityId, len, back, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const T = (c?: number | null) => convTemp(c, tempUnit);
  const delta = (r?: DayRecord) => {
    const n = r && normals?.[r.date.slice(5)];
    return n != null && r?.hi != null ? Math.round((tempUnit === 'F' ? (r.hi - n) * 9 / 5 : r.hi - n) * 10) / 10 : null;
  };
  const yearB = back ? String(+today.slice(0, 4) - back) : '';
  const thisYear = today.slice(0, 4);

  const chart = [];
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const a = log?.[d];
    const b = back ? log?.[shift(d, back)] : undefined;
    chart.push({
      label: shortDate(d),
      High: T(a?.hi), Low: T(a?.lo), Normal: T(normals?.[d.slice(5)]),
      mm: a?.mm ?? null, 'vs avg': delta(a),
      HighB: T(b?.hi), mmB: b?.mm ?? null, 'vs avgB': delta(b),
    });
  }
  const base = { dataKey: 'label', xAxisProps: { interval: Math.max(0, Math.ceil(chart.length / 6) - 1) } };
  const hi = { name: 'High', label: back ? `${t('city.high')} ${thisYear}` : t('city.high'), color: 'signal.4' };
  const hiB = { name: 'HighB', label: `${t('city.high')} ${yearB}`, color: 'dark.2' };

  return (
    <Box px={20}>
      <div className="kicker" style={{ paddingBottom: 8 }}>{t('history.trends')}</div>
      <div className="metric-tabs" role="tablist" style={{ marginBottom: 8 }}>
        {METRICS.map((m) => (
          <button key={m.value} type="button" role="tab" aria-selected={m.value === metric}
            data-active={m.value === metric || undefined} onClick={() => setMetric(m.value)}>{t(m.label)}</button>
        ))}
      </div>
      <div className="metric-tabs" role="tablist" style={{ marginBottom: 8 }}>
        {LENGTHS.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={d === len} data-active={d === len || undefined}
            onClick={() => setLen(d)}>{d ? `${d === 365 ? '1y' : `${d}d`}` : t('history.all')}</button>
        ))}
      </div>
      <Text fz={12} c="dimmed" pb={4}>{t('history.compare')}</Text>
      <div className="metric-tabs" role="tablist">
        {BACK_YEARS.map((y) => (
          <button key={y} type="button" role="tab" aria-selected={y === back} data-active={y === back || undefined}
            onClick={() => setBack(y)}>{y ? t('history.yearsAgo', { n: y }) : t('history.off')}</button>
        ))}
      </div>

      {busy && (
        <Group gap={8} py={8} wrap="nowrap" role="status">
          <Loader size="xs" />
          <Text fz={12} c="dimmed">{t('history.loadingDays')}</Text>
        </Group>
      )}
      {error && <Text fz={12} c="signal.3" py={8} role="status">{t('history.downloadFailed', { error })}</Text>}

      {metric === 'temp' && (
        <>
          <Text fz={12} c="dimmed" pt={12} pb={4}>{t('history.trendTemp')}</Text>
          <LineChart {...base} h={180} withDots={chart.length < 15} unit="°" data={chart}
            series={back
              ? [hi, hiB]
              : [hi, { name: 'Low', label: t('city.low'), color: 'signal.2' }, { name: 'Normal', label: t('history.normal'), color: 'dark.2' }]} />
        </>
      )}
      {metric === 'delta' && (
        <>
          <Text fz={12} c="dimmed" pt={12} pb={4}>{t('history.trendDelta')}</Text>
          <BarChart {...base} h={160} unit="°" withLegend={!!back} data={chart}
            series={back
              ? [{ name: 'vs avg', label: thisYear, color: 'signal.4' }, { name: 'vs avgB', label: yearB, color: 'dark.2' }]
              : [{ name: 'vs avg', label: t('history.vsAvg'), color: 'signal.5' }]}
            getBarColor={back ? undefined : (v) => (v >= 0 ? 'signal.4' : 'dark.3')}
            referenceLines={[{ y: 0, color: 'dark.2' }]} />
        </>
      )}
      {metric === 'rain' && (
        <>
          <Text fz={12} c="dimmed" pt={12} pb={4}>{t('history.trendPrecip')}</Text>
          <BarChart {...base} h={160} withLegend={!!back} data={chart}
            series={back
              ? [{ name: 'mm', label: thisYear, color: 'signal.4' }, { name: 'mmB', label: yearB, color: 'dark.2' }]
              : [{ name: 'mm', label: t('chart.mm'), color: 'signal.6' }]} />
        </>
      )}
    </Box>
  );
}
