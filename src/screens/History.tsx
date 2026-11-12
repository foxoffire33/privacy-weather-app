import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Group, Paper, SegmentedControl, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { BarChart, LineChart } from '@mantine/charts';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../store';
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

      {rows.length > 1 && (() => {
        const inRange = rows.filter((r) => !s.range || daysBetween(r.date, today) < s.range).slice().reverse();
        const chart = inRange.map((r) => {
          const n = s.normals?.[r.date.slice(5)];
          return {
            label: shortDate(r.date),
            High: convTemp(r.hi, s.tempUnit),
            Low: convTemp(r.lo, s.tempUnit),
            Normal: convTemp(n, s.tempUnit),
            mm: r.mm,
            'vs avg': n != null && r.hi != null ? Math.round((s.tempUnit === 'F' ? (r.hi - n) * 9 / 5 : r.hi - n) * 10) / 10 : null,
          };
        });
        const base = { dataKey: 'label', xAxisProps: { interval: Math.max(0, Math.ceil(chart.length / 6) - 1) } };
        return (
          <Box px={20}>
            <Group justify="space-between" className="kicker" style={{ paddingBottom: 8 }}>
              <span>{t('history.trends')}</span>
              <SegmentedControl size="xs" value={String(s.range)} onChange={(v) => s.setRange(Number(v))}
                data={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: '365', label: '1y' }, { value: '0', label: t('history.all') }]} />
            </Group>
            <Text fz={12} c="dimmed" pt={12} pb={4}>{t('history.trendTemp')}</Text>
            <LineChart {...base} h={180} withDots={chart.length < 15} unit="°"
              data={chart} series={[{ name: 'High', label: t('city.high'), color: 'signal.4' }, { name: 'Low', label: t('city.low'), color: 'signal.2' }, { name: 'Normal', label: t('history.normal'), color: 'dark.2' }]} />
            <Text fz={12} c="dimmed" pt={16} pb={4}>{t('history.trendDelta')}</Text>
            <BarChart {...base} h={120} unit="°" withLegend={false} data={chart} series={[{ name: 'vs avg', label: t('history.vsAvg'), color: 'signal.5' }]}
              getBarColor={(v) => (v >= 0 ? 'signal.4' : 'dark.3')} referenceLines={[{ y: 0, color: 'dark.2' }]} />
            <Text fz={12} c="dimmed" pt={16} pb={4}>{t('history.trendPrecip')}</Text>
            <BarChart {...base} h={120} withLegend={false} data={chart} series={[{ name: 'mm', label: t('chart.mm'), color: 'signal.6' }]} />
          </Box>
        );
      })()}

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
            <UnstyledButton className="row" py={10} w="100%" onClick={() => open(r.date)}
              style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto', alignItems: 'baseline', gap: 8 }}>
              <Text fz={14} fw={800}>{r.date === today ? t('common.today') : shortDate(r.date)}</Text>
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <Text fz={13} c="dimmed" truncate>{t('history.rowDetail', { cond: conditionLabel(r.code), mm: (r.mm || 0).toFixed(1) })}{r.feelsHi != null ? t('history.rowFeels', { t: T(r.feelsHi) }) : ''}</Text>
                {r.source === 'filled' && <Badge variant="outline" color="gray" size="xs">{t('history.filled')}</Badge>}
              </Group>
              <Text fz={20} fw={800}>
                {T(r.hi)}°
                {delta && <Text span fz={12} ml={6} c={delta.startsWith('+') ? 'signal.3' : 'dimmed'}>{delta}</Text>}
              </Text>
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
      <UnstyledButton onClick={() => setShow(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800 }}>
        <Icon name="plus" size={14} /> {t('history.addDates')}
      </UnstyledButton>
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
