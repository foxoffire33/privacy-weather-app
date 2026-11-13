import { useEffect } from 'react';
import { Box, Button, Group, Loader, Text, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useShallow } from 'zustand/react/shallow';
import { followCity, useCityStore, useSearchStore } from '../storesV2';
import { useUiStore } from '../store/uiStore';
import type { GeoResult } from '../storesV2';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';
import { Sk } from '../components/Skeletons';
import { t } from '../i18n';

export function Search() {
  const s = useSearchStore(useShallow((st) => ({
    query: st.query,
    results: st.results,
    searching: st.request.status === 'loading',
    searchError: st.request.error,
    setQuery: st.setQuery,
    runSearch: st.run,
  })));
  const followedIds = useCityStore((st) => st.cityIds.join('|'));
  const goHome = useUiStore((st) => st.goHome);
  const [debounced] = useDebouncedValue(s.query, 300);
  const { runSearch } = s;
  useEffect(() => { void runSearch(debounced); }, [debounced, runSearch]);
  const followed = new Set(followedIds.split('|'));
  const follow = (r: GeoResult) => {
    const i = followCity(r);
    s.setQuery('');
    goHome(i);
  };
  return (
    <Box className="screen">
      <ScreenHeader />
      <Title className="display display-sm" style={{ whiteSpace: 'pre-line' }}>{t('search.title')}</Title>
      <Box px={20}>
        <TextInput size="lg" placeholder={t('search.placeholder')} autoFocus value={s.query}
          leftSection={<Icon name="search" size={20} />}
          rightSection={s.searching ? <Loader size="xs" /> : null}
          onChange={(e) => s.setQuery(e.currentTarget.value)}
          aria-label={t('search.label')} />
      </Box>

      <Box px={20} style={{ flex: 1 }}>
        <Box className="kicker">{t('search.results')}</Box>
        {s.searchError && <Text py={12} fz={13} c="signal.3">{s.searchError}</Text>}
        {!s.searchError && s.query.trim().length < 2 && <Text py={12} fz={13} c="dimmed">{t('search.typeMore')}</Text>}
        {!s.searching && s.query.trim().length >= 2 && s.results.length === 0 && !s.searchError && (
          <Text py={12} fz={13} c="dimmed">{t('search.noMatch', { query: s.query })}</Text>
        )}
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
              <Button variant="outline" color="gray" disabled={isFollowed} miw={104} onClick={() => follow(r)}>
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
