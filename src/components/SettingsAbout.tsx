import { Anchor, Box, Button, Stack, Text } from '@mantine/core';

import { t } from '../i18n';
import { LINKS } from '../utils/links';

import { Icon } from './Icon';

import type { SettingsAboutProps } from '../types';
import type { ReactElement } from 'react';

export function SettingsAbout({ version }: SettingsAboutProps): ReactElement {
  return (
    <>
      <Box className="kicker">{t('settings.services')}</Box>
      <Stack gap={4} py={12}>
        <Text fz={14} fw={600}>Open-Meteo</Text>
        <Text fz={13} c="dimmed">{t('settings.openMeteoUse')}</Text>
        <Anchor fz={13} href={LINKS.openMeteo} target="_blank" rel="noopener noreferrer">open-meteo.com</Anchor>
        <Anchor fz={13} href={LINKS.openMeteoTerms} target="_blank" rel="noopener noreferrer">{t('settings.openMeteoPrivacy')}</Anchor>
      </Stack>

      <Box className="kicker">{t('settings.developer')}</Box>
      <Stack gap={4} py={12}>
        <Anchor fz={13} href={LINKS.website} target="_blank" rel="noopener noreferrer">delaparra-services.nl</Anchor>
        <Anchor fz={13} href={`mailto:${LINKS.email}`}>{LINKS.email}</Anchor>
        <Anchor fz={13} href={LINKS.github} target="_blank" rel="noopener noreferrer">github.com/foxoffire33</Anchor>
        <Anchor fz={13} href={LINKS.source} target="_blank" rel="noopener noreferrer">{t('settings.sourceCode')}</Anchor>
        <Text fz={13} c="dimmed" mt={8}>{t('settings.donateNote')}</Text>
        <Button component="a" href={LINKS.sponsor} target="_blank" rel="noopener noreferrer" fullWidth mt={4}
          leftSection={<Icon name="heart" size={16} />}>
          {t('settings.donate')}
        </Button>
      </Stack>

      <Box className="kicker">{t('settings.about')}</Box>
      <Stack gap={4} py={12}>
        <Text fz={13} c="dimmed">{t('settings.license', { version })}</Text>
        <Text fz={13} c="dimmed">{t('settings.attribution')}</Text>
      </Stack>
    </>
  );
}
