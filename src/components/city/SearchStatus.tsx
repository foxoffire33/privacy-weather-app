import { Text } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';

import { t } from '../../i18n';
import { useSearchStore } from '../../stores';

import { ManualCityForm } from './ManualCityForm';

import type { ManualCityFormProps } from '../../types';
import type { ReactElement } from 'react';

export function SearchStatus({ onAdded }: ManualCityFormProps): ReactElement {
  const s = useSearchStore(useShallow((st) => ({
    query: st.query.trim(),
    count: st.results.length,
    searching: st.request.status === 'loading',
    error: st.request.error,
  })));
  const failed = s.error !== null && s.error !== '';
  const noMatch = !failed && !s.searching && s.query.length >= 2 && s.count === 0;
  return (
    <>
      {failed && <Text py={12} fz={13} c="signal.3">{s.error}</Text>}
      {!failed && s.query.length < 2 && <Text py={12} fz={13} c="dimmed">{t('search.typeMore')}</Text>}
      {noMatch && <Text py={12} fz={13} c="dimmed">{t('search.noMatch', { query: s.query })}</Text>}
      {(failed || noMatch) && (
        <>
          <Text fz={13} c="dimmed" mb="md">{t(failed ? 'offline.manualCity' : 'offline.notFound')}</Text>
          <ManualCityForm onAdded={onAdded} />
        </>
      )}
    </>
  );
}
