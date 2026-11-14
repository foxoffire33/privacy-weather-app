import { Box, Button, Group, Loader, Text, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';

import { ManualCityForm } from '../components/city/ManualCityForm';
import { SearchStatus } from '../components/city/SearchStatus';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sk } from '../components/Skeletons';
import { t } from '../i18n';
import { followCity, useCityStore, useSearchStore, useSettings } from '../stores';
import { useUiStore } from '../stores/uiStore';
import { BACK_STATE, paths } from '../utils/paths';

import type { GeoResult } from '../stores';
import type { ReactElement } from 'react';

export function Search(): ReactElement {
  const s = useSearchStore(useShallow((st) => ({
    query: st.query,
    results: st.results,
    searching: st.request.status === 'loading',
    setQuery: st.setQuery,
    runSearch: st.run,
  })));
  const followedIds = useCityStore((st) => st.cityIds.join('|'));
  const setPage = useUiStore((st) => st.setPage);
  const navigate = useNavigate();
  const [debounced] = useDebouncedValue(s.query, 300);
  const { runSearch } = s;
  useEffect(() => { void runSearch(debounced); }, [debounced, runSearch]);
  const followed = new Set(followedIds.split('|'));
  const offline = useSettings().offline;
  const goTo = (i: number) => {
    s.setQuery('');
    setPage(i);
    void navigate(paths.home, { state: BACK_STATE });
  };
  const follow = (r: GeoResult) => { goTo(followCity(r)); };
  if (offline) {
    return (
      <Box className="screen">
        <ScreenHeader />
        <Title className="display display-sm" style={{ whiteSpace: 'pre-line' }}>{t('search.title')}</Title>
        <Box px={20} pb={24}>
          <Text fz={13} c="dimmed" mb="md">{t('offline.cityNote')}</Text>
          <ManualCityForm onAdded={goTo} />
        </Box>
      </Box>
    );
  }
  return (
    <Box className="screen">
      <ScreenHeader />
      <Title className="display display-sm" style={{ whiteSpace: 'pre-line' }}>{t('search.title')}</Title>
      <Box px={20}>
        <TextInput size="lg" placeholder={t('search.placeholder')} value={s.query}
          leftSection={<Icon name="search" size={20} />}
          rightSection={s.searching ? <Loader size="xs" /> : null}
          onChange={(e) => { s.setQuery(e.currentTarget.value); }}
          aria-label={t('search.label')} />
      </Box>

      <Box px={20} style={{ flex: 1 }}>
        <Box className="kicker">{t('search.results')}</Box>
        <SearchStatus onAdded={goTo} />
        {s.searching && s.results.length === 0 && Array.from({ length: 4 }, (_, i) => (
          <Group key={i} className="row" py={12} wrap="nowrap" justify="space-between">
            <Box><Sk w={120} h={20} /><Sk w={190} h={12} mt={6} /></Box>
            <Sk w={104} h={36} />
          </Group>
        ))}
        {s.results.map((r) => {
          const isFollowed = followed.has(String(r.id));
          return (
            <Group key={r.id} className="row" py={12} wrap="nowrap" justify="space-between">
              <Box style={{ minWidth: 0 }}>
                <Text fz={18} fw={800} truncate>{r.name}</Text>
                <Text fz={12} c="dimmed" truncate>
                  {[r.admin1, r.country].filter(Boolean).join(', ')} · {r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}°
                </Text>
              </Box>
              <Button variant="outline" color="gray" disabled={isFollowed} miw={104} onClick={() => { follow(r); }}>
                {isFollowed ? t('search.following') : t('search.follow')}
              </Button>
            </Group>
          );
        })}
      </Box>

      <Group px={20} py={14} gap={8} wrap="nowrap" className="rule-top">
        <Icon name="lock" size={16} />
        <Text fz={12} c="dimmed">{t('search.privacy')}</Text>
      </Group>
    </Box>
  );
}
