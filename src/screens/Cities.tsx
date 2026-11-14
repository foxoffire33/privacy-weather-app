import { ActionIcon, Badge, Box, Button, Group, Text, Title, UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { Reorder } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { CityRow } from '../components/city/CityRow';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sk } from '../components/Skeletons';
import { t, tl } from '../i18n';
import { unfollowCity, useCities, useCityStore, useForecastStore, useLogStore, useUnits } from '../stores';
import { useUiStore } from '../stores/uiStore';
import { fmtTemp } from '../utils/format';
import { BACK_STATE, paths } from '../utils/paths';
import { conditionLabel } from '../utils/weatherCodes';

import type { ReactElement } from 'react';

export function Cities(): ReactElement {
  const cities = useCities();
  const forecasts = useForecastStore((s) => s.forecasts);
  const logged = useLogStore((s) => s.dates);
  const tempUnit = useUnits().temp;
  const reorderCities = useCityStore((s) => s.reorder);
  const setPage = useUiStore((s) => s.setPage);
  const navigate = useNavigate();
  const n = cities.length;
  const ids = cities.map((c) => c.id);
  const [order, setOrder] = useState<string[] | null>(null);
  const shown = order ?? ids;
  const byId = new Map(cities.map((c, i) => [c.id, { city: c, index: i }]));
  const drop = (id: string) => {
    const to = shown.indexOf(id);
    const from = ids.indexOf(id);
    setOrder(null);
    if (from !== -1 && to !== -1 && from !== to) { reorderCities(from, to); }
  };
  return (
    <Box className="screen" style={{ overflow: 'hidden' }}>
      <Box className="cities-scroll">
        <ScreenHeader />
        <Title className="display" style={{ whiteSpace: 'pre-line' }}>{t('cities.title', { count: n, word: tl('cities.count')[n] ?? n })}</Title>
        <Text px={20} pb={16} fz={13} c="dimmed">{t('cities.hint')}</Text>

        <Reorder.Group as="div" axis="y" values={shown} onReorder={setOrder} className="rule-top">
          {shown.map((id) => {
            const entry = byId.get(id);
            if (entry === undefined) { return null; }
            const { city: c, index: i } = entry;
            const f = forecasts[c.id];
            const days = (logged[c.id] ?? []).length;
            return (
              <CityRow key={c.id} value={c.id} label={t('cities.reorder', { name: c.name })} onDrop={drop}>
                  <Group justify="space-between" align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }} py={16} pr={8}>
                    <UnstyledButton onClick={() => { setPage(i); void navigate(paths.home, { state: BACK_STATE }); }} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={8} wrap="nowrap">
                        <Text fz={22} fw={800} truncate>{c.name}</Text>
                        {i === 0 && <Badge size="sm">{t('common.default')}</Badge>}
                      </Group>
                      {f ? (
                        <Text fz={13} c="dimmed" truncate>
                          {conditionLabel(f.data.current.v.weather_code)} · {t('common.daysLogged', { count: days })}
                        </Text>
                      ) : <Sk w={150} h={13} mt={4} />}
                    </UnstyledButton>
                    {f ? (
                      <Text fz={44} fw={800} lh={0.9} style={{ letterSpacing: '-.04em' }}>
                        {fmtTemp(f.data.current.v.temperature_2m, tempUnit)}°
                      </Text>
                    ) : <Sk w={56} h={40} />}
                    <ActionIcon size={40} aria-label={t('cities.unfollow', { name: c.name })}
                      onClick={() => modals.openConfirmModal({
                        groupProps: { grow: true, wrap: 'nowrap', mt: 16 },
                        children: t('cities.confirmUnfollow', { name: c.name }),
                        labels: { confirm: t('cities.stopFollowing'), cancel: t('common.cancel') },
                        onConfirm: () => { unfollowCity(c.id); },
                      })}>
                      <Icon name="x" size={18} />
                    </ActionIcon>
                  </Group>
              </CityRow>
            );
          })}
        </Reorder.Group>
      </Box>

      <Button size="xl" fullWidth rightSection={<Icon name="plus" />} onClick={() => { void navigate(paths.search); }}>
        {t('cities.followCity')}
      </Button>
    </Box>
  );
}
