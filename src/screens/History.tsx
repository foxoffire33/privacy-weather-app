import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Group, Paper, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import {
  addDateRange, lookupDate, NO_ARCHIVE_DATA, useCity, useCityIndex, useCityLog, useForecast,
  useLookup, useNormals, useThisDay, useUnits,
} from '../storesV2';
import { useUiStore } from '../store/uiStore';
import { useAlmanacStore } from '../storesV2';
import { useLogStore } from '../storesV2';
import { conditionLabel } from '../lib/weatherCodes';
import { downloadFile, fmtDelta, fmtTemp, fmtWind, longDate, shortDate } from '../lib/format';
import { addDays, daysBetween, todayISO } from '../storesV2';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';
import { Sk } from '../components/Skeletons';
import { SwipeRow } from '../components/SwipeRow';
import { Trends } from '../components/history/Trends';
import { t } from '../i18n';

export function History({ cityId }: { cityId: string }) {
  const city = useCity(cityId);
  const entry = useForecast(cityId);
  const units = useUnits();
  const today = entry ? entry.data.daily.time[entry.pastDays] : todayISO();
  const draft = useUiStore((st) => st.lookupDraft);
  const lookup = useLookup(cityId, draft);
  const s = {
    city,
    log: useCityLog(cityId),
    normals: useNormals(cityId),
    today,
    years: useThisDay(cityId, today),
    draft,
    lookup,
    tempUnit: units.temp,
    windUnit: units.wind,
    deleteLogDay: useLogStore((st) => st.removeDay),
    cityIndex: useCityIndex(cityId),
    ...useUiStore(useShallow((st) => ({ setLookupDraft: st.setLookupDraft, navigate: st.navigate, goHome: st.goHome }))),
  };
  const ensureThisDay = useAlmanacStore((st) => st.ensureThisDay);
  useEffect(() => { if (city) void ensureThisDay(city, today); }, [city, today, ensureThisDay]);
  const maxLookupDate = addDays(today, -5);
  const validDraft = /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft >= '1940-01-01' && draft <= maxLookupDate;
  const lookedUp = s.lookup.query.status !== 'idle';
  const [swiped, setSwiped] = useState<string | null>(null);
  useEffect(() => {
    if (!validDraft || lookedUp) return;
    const t = window.setTimeout(() => void lookupDate(cityId, draft), 350);
    return () => window.clearTimeout(t);
  }, [validDraft, lookedUp, cityId, draft, lookupDate]);
  if (!s.city) return <div className="screen"><ScreenHeader /><Text px={20}>{t('common.noLongerFollowed')}</Text></div>;
  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const loadingLookup = s.lookup.query.status === 'loading';
  const lookupError = s.lookup.query.error === NO_ARCHIVE_DATA ? t('history.noArchive') : s.lookup.query.error;
  const lookupRecord = s.lookup.query.status === 'success' ? s.lookup.record : undefined;
  const rows = Object.values(s.log ?? {}).sort((a, b) => b.date.localeCompare(a.date));
  const maxLookup = addDays(today, -5);
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
            <UnstyledButton mt={12} w="100%" disabled={loadingLookup || lookupError !== null || lookupRecord === undefined} onClick={() => {
                void addDateRange(cityId, s.draft, s.draft).catch(() => undefined);
                open(s.draft);
              }}
              style={{ border: '2px solid var(--rule)', display: 'block' }}>
              {loadingLookup || lookupRecord === undefined ? (
                <Box p={14}><Sk w={140} h={12} /><Sk w={120} h={40} mt={10} /><Sk h={14} mt={10} /></Box>
              ) : lookupError !== null ? (
                <Box p={14}><Text fz={13} c="signal.3">{lookupError}</Text></Box>
              ) : (
                <>
                  <Group className="accent-field" justify="space-between" px={14} py={8} wrap="nowrap">
                    <Text fz={12} fw={800} tt="uppercase" style={{ letterSpacing: '.06em' }}>{longDate(s.draft)}</Text>
                    <Icon name="arrow" size={16} />
                  </Group>
                  <Box p={14}>
                    <Group justify="space-between" align="flex-end" wrap="nowrap">
                      <Text fz={16} fw={800}>{conditionLabel(lookupRecord.code)}</Text>
                      <Text fz={40} fw={800} lh={1}>{T(lookupRecord.hi)}°<Text span fz={20} c="dimmed" fw={600}> / {T(lookupRecord.lo)}°</Text></Text>
                    </Group>
                    <div className="stat-grid" style={{ marginTop: 12 }}>
                      <Box><Text fz={12} tt="uppercase" c="dimmed">{t('history.rain')}</Text><Text fz={16} fw={800}>{(lookupRecord.mm ?? 0).toFixed(1)} mm</Text></Box>
                      <Box><Text fz={12} tt="uppercase" c="dimmed">{t('history.maxWind')}</Text><Text fz={16} fw={800}>{fmtWind(lookupRecord.wind, s.windUnit)}</Text></Box>
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
          tempUnit={s.tempUnit} windUnit={s.windUnit} />
      )}

      <Box px={20} pb={24}>
        <Group justify="space-between" className="kicker" wrap="nowrap">
          <span>{t('history.yourLog', { days: t('common.days', { count: rows.length }) })}</span>
          <ImportRange cityId={cityId} maxDate={maxLookup} />
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

function ImportRange({ cityId, maxDate }: { cityId: string; maxDate: string }) {
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
      const c = await addDateRange(cityId, from, to);
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
    <Box className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setShow(false); }}>
      <Paper className="glass" w="100%" maw={420} p={16} style={{ textTransform: 'none', letterSpacing: 0 }}
        role="dialog" aria-label={t('history.addTitle')}>
        <Group justify="space-between" mb={8}>
          <Text fz={16} fw={800}>{t('history.addTitle')}</Text>
          <ActionIcon size={44} aria-label={t('common.close')} onClick={() => setShow(false)} disabled={busy}><Icon name="x" size={20} /></ActionIcon>
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
