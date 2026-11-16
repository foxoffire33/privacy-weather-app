import { Box, Button, PasswordInput, TextInput } from '@mantine/core';

import { t } from '../i18n';
import { PUBLIC_MAP_SERVER, PUBLIC_RADAR_SERVER, refreshAll, useSettings, useUpdateSettings } from '../stores';

import type { ReactElement } from 'react';

export function SettingsDataSource(): ReactElement {
  const settings = useSettings();
  const set = useUpdateSettings();
  return (
    <>
      <Box className="kicker">{t('settings.dataSource')}</Box>
      <Box py={12} className="row">
        <PasswordInput label={t('settings.apiKey')} placeholder={t('settings.optional')} value={settings.apiKey}
          description={t('settings.apiKeyNote')}
          onChange={(e) => { set({ apiKey: e.currentTarget.value.trim() }); }} />
      </Box>
      <Box py={12} className="row">
        <TextInput label={t('settings.server')} placeholder="https://api.open-meteo.com" value={settings.server}
          description={t('settings.serverNote')}
          onChange={(e) => { set({ server: e.currentTarget.value.trim() }); }} />
      </Box>
      <Box py={12} className="row">
        <TextInput label={t('settings.radarServer')} placeholder={PUBLIC_RADAR_SERVER} value={settings.radarServer}
          description={t('settings.radarServerNote')} inputMode="url"
          onChange={(e) => { set({ radarServer: e.currentTarget.value.trim() }); }} />
      </Box>
      <Box py={12} className="row">
        <TextInput label={t('settings.mapServer')} placeholder={PUBLIC_MAP_SERVER} value={settings.mapServer}
          description={t('settings.mapServerNote')} inputMode="url"
          onChange={(e) => { set({ mapServer: e.currentTarget.value.trim() }); }} />
      </Box>
      <Button variant="subtle" color="gray" mt={8} onClick={() => void refreshAll({ maxAgeMs: 0 })}>{t('settings.apply')}</Button>
    </>
  );
}
