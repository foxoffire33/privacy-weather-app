import { Box, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useUiStore } from '../stores/uiStore';
import { Icon } from '../components/Icon';
import { t } from '../i18n';

export function Onboarding() {
  const navigate = useUiStore((s) => s.navigate);
  const STEPS = [
    { t: t('onboarding.step1Title'), d: t('onboarding.step1Text') },
    { t: t('onboarding.step2Title'), d: t('onboarding.step2Text') },
    { t: t('onboarding.step3Title'), d: t('onboarding.step3Text') },
  ];
  return (
    <Box className="screen accent-field">
      <Title className="display display-xl">{t('onboarding.title')}</Title>
      <Stack gap={0} mx={20} className="onboard-rules">
        {STEPS.map((s, i) => (
          <Group key={s.t} wrap="nowrap" align="flex-start" py={14} className="onboard-step">
            <Text fw={800} w={36}>{`0${i + 1}`}</Text>
            <Box className="flex-fill">
              <Text fw={800} fz={17}>{s.t}</Text>
              <Text fw={600} fz={14}>{s.d}</Text>
            </Box>
          </Group>
        ))}
      </Stack>
      <Button variant="white" color="dark" size="xl" fullWidth rightSection={<Icon name="arrow" />}
        onClick={() => navigate({ name: 'search' })}>
        {t('onboarding.start')}
      </Button>
    </Box>
  );
}
