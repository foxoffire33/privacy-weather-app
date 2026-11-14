import { Badge, Box, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useIntersection } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { t } from '../../i18n';
import { useLogStore, useNormals, useUnits } from '../../stores';
import { useUiStore } from '../../stores/uiStore';
import { fmtDelta, fmtTemp, longDate, shortDate } from '../../utils/format';
import { conditionLabel } from '../../utils/weatherCodes';
import { DayEntryForm } from '../day/DayEntryForm';
import { Icon } from '../Icon';
import { SwipeRow } from '../SwipeRow';

import type { DayRecord } from '../../stores';
import type { HistoryLogProps, HistoryRowProps } from '../../types';
import type { ReactElement } from 'react';

function matches(r: DayRecord, q: string): boolean {
  return [r.date, longDate(r.date), shortDate(r.date), conditionLabel(r.code), r.source].some((v) => v.toLowerCase().includes(q));
}

function HistoryRow({ cityId, record: r, today, open, onOpenChange, onOpen, onEdit }: HistoryRowProps): ReactElement {
  const units = useUnits();
  const normal = useNormals(cityId)?.[r.date.slice(5)];
  const deleteLogDay = useLogStore((st) => st.removeDay);
  const T = (c?: number | null) => fmtTemp(c, units.temp);
  const delta = normal !== undefined && r.hi !== null && r.hi !== undefined ? fmtDelta(r.hi - normal, units.temp) : null;
  return (
    <SwipeRow label={longDate(r.date)} disabled={r.date === today} open={open} onOpenChange={onOpenChange}
      onDelete={() => { deleteLogDay(cityId, r.date); onOpenChange(false); }} onEdit={() => { onEdit(r.date); }}>
      <UnstyledButton className="log-row row" py={10} w="100%" onClick={() => { onOpen(r.date); }}>
        <Text fz={14} fw={800}>{r.date === today ? t('common.today') : shortDate(r.date)}</Text>
        <Text fz={13} c="dimmed" truncate>{t('history.rowDetail', { cond: conditionLabel(r.code), mm: (r.mm ?? 0).toFixed(1) })}{r.feelsHi === null || r.feelsHi === undefined ? '' : t('history.rowFeels', { t: T(r.feelsHi) })}</Text>
        <Box component="span">{r.source === 'filled' && <Badge variant="outline" color="gray" size="xs">{t('history.filled')}</Badge>}{r.source === 'edited' && <Badge variant="outline" color="gray" size="xs">{t('history.edited')}</Badge>}</Box>
        <Text fz={20} fw={800} ta="right">{T(r.hi)}°</Text>
        <Text fz={12} ta="right" c={delta?.startsWith('+') === true ? 'signal.3' : 'dimmed'}>{delta ?? ''}</Text>
      </UnstyledButton>
    </SwipeRow>
  );
}

export function HistoryLog({ cityId, rows, today, onOpen }: HistoryLogProps): ReactElement {
  const { filter, setFilter, limit, showMore, resetLimit } = useUiStore(useShallow((st) => ({
    filter: st.logFilter, setFilter: st.setLogFilter, limit: st.logLimit, showMore: st.showMoreLog, resetLimit: st.resetLogLimit,
  })));
  const [swiped, setSwiped] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const { ref: sentinelRef, entry } = useIntersection<HTMLDivElement>({ rootMargin: '400px 0px' });
  const q = filter.trim().toLowerCase();
  const visible = q === '' ? rows : rows.filter((r) => matches(r, q));
  const shown = visible.slice(0, limit);
  const more = shown.length < visible.length;
  const reachedEnd = entry?.isIntersecting === true;
  useEffect(() => { resetLimit(); }, [cityId, resetLimit]);
  useEffect(() => { if (reachedEnd && more) { showMore(); } }, [reachedEnd, more, shown.length, showMore]);
  return (
    <>
      {rows.length > 0 && (
        <TextInput mt={14} placeholder={t('history.search')} aria-label={t('history.search')}
          leftSection={<Icon name="search" size={16} />} value={filter}
          onChange={(e) => { setFilter(e.currentTarget.value); }} />
      )}
      {rows.length === 0 && <Text py={12} fz={13} c="dimmed">{t('history.empty')}</Text>}
      {rows.length > 0 && visible.length === 0 && <Text py={12} fz={13} c="dimmed">{t('history.noMatches')}</Text>}
      {shown.map((r) => (
        <HistoryRow key={r.date} cityId={cityId} record={r} today={today} open={swiped === r.date}
          onOpenChange={(o) => { setSwiped(o ? r.date : null); }} onOpen={onOpen} onEdit={setEditing} />
      ))}
      {more && <Box ref={sentinelRef} h={1} aria-hidden />}
      <DayEntryForm cityId={cityId} date={editing ?? undefined} opened={editing !== null} onClose={() => { setEditing(null); }} />
    </>
  );
}
