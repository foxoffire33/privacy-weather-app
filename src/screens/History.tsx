import { Suspense, useEffect, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Drawer, Group, Paper, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useShallow } from 'zustand/react/shallow';
import {
  addDayToLog, addDays, daysBetween, lookupDate, NO_ARCHIVE_DATA, todayISO, useCity,
  useCityIndex, useCityLog, useForecast, useImportQuery, useLogStore, useLookupData, useNormals, useThisDayData, useUnits,
} from '../stores';
import { useUiStore } from '../stores/uiStore';
import { useAddDatesStore } from '../stores/addDatesStore';
import { conditionLabel } from '../lib/weatherCodes';
import { downloadFile, fmtDelta, fmtTemp, fmtWind, longDate, shortDate } from '../lib/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';
import { Sk } from '../components/Skeletons';
import { SwipeRow } from '../components/SwipeRow';
import { Trends } from '../components/history/Trends';
import { t } from '../i18n';
import type { CityScreenProps, ImportRangeProps, LookupCardProps, YearsRowProps } from '../types';

export function History({ cityId }: CityScreenProps) {
  const city = useCity(cityId);
  const entry = useForecast(cityId);
  const units = useUnits();
  const today = entry ? entry.data.daily.time[entry.pastDays] : todayISO();
  const draft = useUiStore((st) => st.lookupDraft);
  const [settledDraft] = useDebouncedValue(draft, 350);
  const s = {
    city,
    log: useCityLog(cityId),
    normals: useNormals(cityId),
    today,
    draft,
    tempUnit: units.temp,
    windUnit: units.wind,
    deleteLogDay: useLogStore((st) => st.removeDay),
    cityIndex: useCityIndex(cityId),
    ...useUiStore(useShallow((st) => ({ setLookupDraft: st.setLookupDraft, navigate: st.navigate, goHome: st.goHome, logFilter: st.logFilter, setLogFilter: st.setLogFilter }))),
  };
  const maxLookupDate = addDays(today, -5);
  const validDraft = /^\d{4}-\d{2}-\d{2}$/.test(settledDraft) && settledDraft >= '1940-01-01' && settledDraft <= maxLookupDate;
  const [swiped, setSwiped] = useState<string | null>(null);
  if (!s.city) return <Box className="screen"><ScreenHeader /><Text px={20}>{t('common.noLongerFollowed')}</Text></Box>;
  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const rows = Object.values(s.log ?? {}).sort((a, b) => b.date.localeCompare(a.date));
  const q = s.logFilter.trim().toLowerCase();
  const visible = q === '' ? rows : rows.filter((r) =>
    [r.date, longDate(r.date), shortDate(r.date), conditionLabel(r.code), r.source].some((v) => v.toLowerCase().includes(q)));
  const maxLookup = addDays(today, -5);
  const open = (date: string) => (date === today ? s.goHome(s.cityIndex) : s.navigate({ name: 'day', cityId, date }));
  const exportCsv = () => {
    const head = 'date,max_c,min_c,feels_max_c,feels_min_c,precip_mm,snow_cm,wind_max_kmh,gust_max_kmh,sunshine_s,uv_max,weather_code,source';
    const body = rows.map((r) => [r.date, r.hi, r.lo, r.feelsHi, r.feelsLo, r.mm, r.snow, r.wind, r.gust, r.sunshine, r.uv, r.code, r.source].map((x) => x ?? '').join(',')).join('\n');
    downloadFile(`${s.city!.name.toLowerCase().replace(/\s+/g, '-')}-history.csv`, `${head}\n${body}`, 'text/csv');
  };
  return (
    <Box className="screen">
      <ScreenHeader right={
        <ActionIcon aria-label={t('history.export')} disabled={!rows.length} onClick={exportCsv}><Icon name="download" size={20} /></ActionIcon>
      } />
      <Text px={20} fz={13} c="dimmed">{s.city.name}</Text>
      <Title className="display display-sm" style={{ whiteSpace: 'pre-line' }}>{t('history.title')}</Title>

      <Paper className="glass" mx={12}>
        <Suspense fallback={<YearsRowSk />}>
          <YearsRow cityId={cityId} today={today} onOpen={open} />
        </Suspense>
        <Box p={12} style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <TextInput type="date" label={t('history.lookup')}
            min="1940-01-01" max={maxLookup} value={s.draft}
            onChange={(e) => s.setLookupDraft(e.currentTarget.value)} />
          {validDraft && (
            <Suspense fallback={<LookupCardSk />}>
              <LookupCard cityId={cityId} date={settledDraft} onOpen={open} />
            </Suspense>
          )}
        </Box>
      </Paper>

      {rows.length > 1 && (
        <Trends cityId={cityId} log={s.log} normals={s.normals} today={today} followedAt={s.city.followedAt}
          tempUnit={s.tempUnit} windUnit={s.windUnit} />
      )}

      <Box px={20} pb={24}>
        <Group justify="space-between" className="kicker" wrap="nowrap">
          <Box component="span">{t('history.yourLog', { days: t('common.days', { count: rows.length }) })}</Box>
          <ImportRange cityId={cityId} maxDate={maxLookup} />
        </Group>
        {rows.length > 0 && (
          <TextInput mt={14} placeholder={t('history.search')} aria-label={t('history.search')}
            leftSection={<Icon name="search" size={16} />} value={s.logFilter}
            onChange={(e) => s.setLogFilter(e.currentTarget.value)} />
        )}
        {rows.length === 0 && <Text py={12} fz={13} c="dimmed">{t('history.empty')}</Text>}
        {rows.length > 0 && visible.length === 0 && <Text py={12} fz={13} c="dimmed">{t('history.noMatches')}</Text>}
        {visible.map((r) => {
          const normal = s.normals?.[r.date.slice(5)];
          const delta = normal != null && r.hi != null ? fmtDelta(r.hi - normal, s.tempUnit) : null;
          return (
            <SwipeRow key={r.date} label={longDate(r.date)} disabled={r.date === today}
              open={swiped === r.date} onOpenChange={(o) => setSwiped(o ? r.date : null)}
              onDelete={() => { s.deleteLogDay(cityId, r.date); setSwiped(null); }}>
            <UnstyledButton className="log-row row" py={10} w="100%" onClick={() => open(r.date)}>
              <Text fz={14} fw={800}>{r.date === today ? t('common.today') : shortDate(r.date)}</Text>
              <Text fz={13} c="dimmed" truncate>{t('history.rowDetail', { cond: conditionLabel(r.code), mm: (r.mm || 0).toFixed(1) })}{r.feelsHi != null ? t('history.rowFeels', { t: T(r.feelsHi) }) : ''}</Text>
              <Box component="span">{r.source === 'filled' && <Badge variant="outline" color="gray" size="xs">{t('history.filled')}</Badge>}</Box>
              <Text fz={20} fw={800} ta="right">{T(r.hi)}°</Text>
              <Text fz={12} ta="right" c={delta?.startsWith('+') ? 'signal.3' : 'dimmed'}>{delta ?? ''}</Text>
            </UnstyledButton>
            </SwipeRow>
          );
        })}
      </Box>
    </Box>
  );
}

function YearsRowSk() {
  return (
    <Box className="archive-grid">
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} py={10} pl={12} style={{ borderRight: '1px solid rgba(255,255,255,.1)' }}>
          <Sk w={30} h={11} mt={3} />
          <Sk w={44} h={26} mt={5} />
          <Sk w={56} h={11} mt={5} />
        </Box>
      ))}
    </Box>
  );
}

function YearsRow({ cityId, today, onOpen }: YearsRowProps) {
  const years = useThisDayData(cityId, today) ?? [];
  const units = useUnits();
  const T = (c?: number | null) => fmtTemp(c, units.temp);
  return (
    <Box className="archive-grid">
      {years.map((y) => (
        <UnstyledButton key={y.year} py={10} pl={12} style={{ borderRight: '1px solid rgba(255,255,255,.1)' }}
          disabled={y.error} onClick={() => onOpen(`${y.year}${today.slice(4)}`)}>
          <Text fz={12} c="dimmed">{y.year}</Text>
          <Text fz={22} fw={800}>{y.error ? '–' : `${T(y.hi)}°`}</Text>
          <Text fz={12} c="dimmed">{y.error ? t('history.noData') : `${T(y.lo)}° · ${(y.mm ?? 0).toFixed(1)}mm`}</Text>
        </UnstyledButton>
      ))}
    </Box>
  );
}

function LookupCardSk() {
  return (
    <Box mt={12} p={14} style={{ border: '2px solid var(--rule)' }}>
      <Sk w={140} h={12} /><Sk w={120} h={40} mt={10} /><Sk h={14} mt={10} />
    </Box>
  );
}

function LookupCard({ cityId, date, onOpen }: LookupCardProps) {
  const { record, query } = useLookupData(cityId, date);
  const units = useUnits();
  const T = (c?: number | null) => fmtTemp(c, units.temp);
  if (record === undefined) {
    const error = query.error === NO_ARCHIVE_DATA ? t('history.noArchive') : query.error;
    return (
      <Box mt={12} p={14} style={{ border: '2px solid var(--rule)' }}>
        <Text fz={13} c="signal.3">{error}</Text>
        {query.error !== NO_ARCHIVE_DATA && (
          <Button fullWidth mt={6} variant="outline" color="gray" onClick={() => void lookupDate(cityId, date)}>
            {t('common.tryAgain')}
          </Button>
        )}
      </Box>
    );
  }
  return (
    <UnstyledButton mt={12} w="100%" style={{ border: '2px solid var(--rule)', display: 'block' }}
      onClick={() => { void addDayToLog(cityId, date).catch(() => undefined); onOpen(date); }}>
      <Group className="accent-field" justify="space-between" px={14} py={8} wrap="nowrap">
        <Text fz={12} fw={800} tt="uppercase" style={{ letterSpacing: '.06em' }}>{longDate(date)}</Text>
        <Icon name="arrow" size={16} />
      </Group>
      <Box p={14}>
        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <Text fz={16} fw={800}>{conditionLabel(record.code)}</Text>
          <Text fz={40} fw={800} lh={1}>{T(record.hi)}°<Text span fz={20} c="dimmed" fw={600}> / {T(record.lo)}°</Text></Text>
        </Group>
        <Box className="stat-grid" style={{ marginTop: 12 }}>
          <Box><Text fz={12} tt="uppercase" c="dimmed">{t('history.rain')}</Text><Text fz={16} fw={800}>{(record.mm ?? 0).toFixed(1)} mm</Text></Box>
          <Box><Text fz={12} tt="uppercase" c="dimmed">{t('history.maxWind')}</Text><Text fz={16} fw={800}>{fmtWind(record.wind, units.wind)}</Text></Box>
        </Box>
      </Box>
    </UnstyledButton>
  );
}

function ImportRange({ cityId, maxDate }: ImportRangeProps) {
  const [show, setShow] = useState(false);
  const { draft: { from, to }, result, reset, setDraft, run } = useAddDatesStore(useShallow((st) => ({
    draft: st.draft, result: st.result, reset: st.reset, setDraft: st.setDraft, run: st.run,
  })));
  const busy = useImportQuery(cityId).status === 'loading';
  useEffect(() => { reset(maxDate); }, [cityId, maxDate, reset]);
  const msg = result === null ? null
    : result.ok ? t(result.kept ? 'history.addedKept' : 'history.added', { count: result.added, updated: result.updated, kept: result.kept })
      : t('history.downloadFailed', { error: result.error });
  const days = from && to ? daysBetween(from, to) + 1 : 0;
  const tooLong = days > 3660;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)
    && from >= '1940-01-01' && to <= maxDate && days > 0 && !tooLong;
  if (!show) {
    return (
      <UnstyledButton className="tab-button" onClick={() => setShow(true)}>
        <Icon name="plus" size={14} />{t('history.addDates')}
      </UnstyledButton>
    );
  }
  return (
    <Drawer opened onClose={() => setShow(false)} title={t('history.addTitle')}
      closeOnClickOutside={!busy} closeOnEscape={!busy}
      closeButtonProps={{ size: 44, iconSize: 20, disabled: busy, 'aria-label': t('common.close') }}>
      <Box className="stat-grid">
        <TextInput type="date" label={t('history.from')} min="1940-01-01" max={maxDate} value={from} onChange={(e) => setDraft({ from: e.currentTarget.value })} />
        <TextInput type="date" label={t('history.to')} min="1940-01-01" max={maxDate} value={to} onChange={(e) => setDraft({ to: e.currentTarget.value })} />
      </Box>
      <Text fz={12} c="dimmed" mt={8}>
        {t('history.addNote')}
      </Text>
      {tooLong && <Text fz={12} c="signal.3" mt={6}>{t('history.tooLong')}</Text>}
      <Button fullWidth mt={12} loading={busy} disabled={!valid} onClick={() => void run(cityId)}>
        {valid ? t('history.downloadDays', { count: days }) : t('history.download')}
      </Button>
      {msg && <Text fz={13} mt={10} role="status">{msg}</Text>}
    </Drawer>
  );
}
