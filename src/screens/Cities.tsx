import { ActionIcon, Badge, Box, Button, Group, Text, Title, UnstyledButton } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../store';
import { conditionLabel } from '../lib/weatherCodes';
import { fmtTemp } from '../lib/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';
import { Sk } from '../components/Skeletons';

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

export function Cities() {
  const { cities, forecasts, history, tempUnit, moveCity, makeDefault, unfollowCity, goHome, navigate } = useWeatherStore(useShallow((s) => ({
    cities: s.cities,
    forecasts: s.forecasts,
    history: s.history,
    tempUnit: s.settings.tempUnit,
    moveCity: s.moveCity,
    makeDefault: s.makeDefault,
    unfollowCity: s.unfollowCity,
    goHome: s.goHome,
    navigate: s.navigate,
  })));
  const n = cities.length;

  return (
    <div className="screen" style={{ overflow: 'hidden' }}>
      <div className="cities-scroll">
      <ScreenHeader />
      <Title className="display">{WORDS[n] ?? n}<br />{n === 1 ? 'city.' : 'cities.'}</Title>
      <Text px={20} pb={16} fz={13} c="dimmed">Reorder with the arrows. The top city opens first.</Text>

      <Box className="rule-top">
        {cities.map((c, i) => {
          const f = forecasts[c.id];
          const days = Object.keys(history[c.id] ?? {}).length;
          return (
            <Box key={c.id} px={20} py={14} style={{ borderBottom: '2px solid rgba(248,244,244,.18)' }}>
              <Group justify="space-between" align="flex-end" wrap="nowrap">
                <UnstyledButton onClick={() => goHome(i)} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={8}>
                    <Text fz={22} fw={800} truncate>{c.name}</Text>
                    {i === 0 && <Badge size="sm">Default</Badge>}
                  </Group>
                  {f ? (
                    <Text fz={13} c="dimmed" truncate>
                      {conditionLabel(f.data.current.v.weather_code)} · {days} {days === 1 ? 'day' : 'days'} logged
                    </Text>
                  ) : <Sk w={150} h={13} mt={4} />}
                </UnstyledButton>
                {f ? (
                  <Text fz={52} fw={800} lh={0.9} style={{ letterSpacing: '-.04em' }}>
                    {fmtTemp(f.data.current.v.temperature_2m, tempUnit)}°
                  </Text>
                ) : <Sk w={64} h={47} />}
              </Group>
              <Group gap={4} mt={10}>
                <ActionIcon variant="default" size={40} disabled={i === 0} aria-label="Move up" onClick={() => moveCity(c.id, -1)}>
                  <Icon name="up" size={18} />
                </ActionIcon>
                <ActionIcon variant="default" size={40} disabled={i === n - 1} aria-label="Move down" onClick={() => moveCity(c.id, 1)}>
                  <Icon name="down" size={18} />
                </ActionIcon>
                {i > 0 && <Button variant="subtle" color="gray" size="sm" onClick={() => makeDefault(c.id)}>Make default</Button>}
                <ActionIcon ml="auto" size={40} aria-label={`Unfollow ${c.name}`}
                  onClick={() => { if (window.confirm(`Stop following ${c.name}? Its logged history is kept.`)) unfollowCity(c.id); }}>
                  <Icon name="x" size={18} />
                </ActionIcon>
              </Group>
            </Box>
          );
        })}
      </Box>
      </div>

      <Button size="xl" fullWidth rightSection={<Icon name="plus" />} onClick={() => navigate({ name: 'search' })}>
        Follow a city
      </Button>
    </div>
  );
}
