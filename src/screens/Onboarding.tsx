import { Box, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useWeatherStore } from '../store';
import { Icon } from '../components/Icon';

const STEPS = [
  { t: 'No account, no tracking', d: 'Forecasts come from Open-Meteo. Free for personal use, no key needed.' },
  { t: 'No location access', d: 'You add cities by name. The app never asks for GPS.' },
  { t: 'A full history, on this device', d: 'Every city you follow is logged locally. Nothing is uploaded.' },
];

export function Onboarding() {
  const navigate = useWeatherStore((s) => s.navigate);

  return (
    <div className="screen accent-field">
      <Title className="display" style={{ fontSize: 72, paddingTop: 56 }}>Weather,<br />kept.</Title>
      <Stack gap={0} mx={20} style={{ borderTop: '2px solid #fff', flex: 1 }}>
        {STEPS.map((s, i) => (
          <Group key={s.t} wrap="nowrap" align="flex-start" py={14}
            style={{ borderBottom: i < STEPS.length - 1 ? '2px solid rgba(255,255,255,.5)' : 0 }}>
            <Text fw={800} w={36}>{`0${i + 1}`}</Text>
            <Box style={{ flex: 1 }}>
              <Text fw={800} fz={17}>{s.t}</Text>
              <Text fw={600} fz={14}>{s.d}</Text>
            </Box>
          </Group>
        ))}
      </Stack>
      <Button variant="white" color="dark" size="xl" fullWidth rightSection={<Icon name="arrow" />}
        onClick={() => navigate({ name: 'search' })}>
        Choose your first city
      </Button>
    </div>
  );
}
