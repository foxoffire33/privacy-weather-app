import { Box, Button, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { t } from '../../i18n';
import { refreshCity, todayISO, useDayRecord, useLogCount, useUnits } from '../../stores';
import { fmtTemp } from '../../utils/format';
import { paths } from '../../utils/paths';
import { conditionLabel } from '../../utils/weatherCodes';
import { DayEntryForm } from '../day/DayEntryForm';
import { Icon } from '../Icon';

import { CityTitle } from './CityHero';

import type { CityErrorProps } from '../../types';
import type { ReactElement } from 'react';

export function OfflineCity({ city, isDefault, error }: CityErrorProps): ReactElement {
  const today = todayISO();
  const record = useDayRecord(city.id, today);
  const units = useUnits();
  const logged = useLogCount(city.id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const T = (c?: number | null) => fmtTemp(c, units.temp);
  return (
    <>
      <Box className="hero">
        <CityTitle city={city} isDefault={isDefault} />
        <Box className="hero-temp">{T(record?.hi)}°</Box>
        <Text fz={20} fw={800} mt={8}>{record === undefined ? t('offline.noToday') : conditionLabel(record.code)}</Text>
        <Text fz={13} fw={600}>{record === undefined ? t('offline.heroNote') : t('dayView.lowLine', { lo: T(record.lo), fhi: T(record.feelsHi), flo: T(record.feelsLo) })}</Text>
        {error !== null && (
          <>
            <Text fz={16} fw={800} mt={12}>{t('city.couldNotLoad')}</Text>
            <Text fz={13} fw={600}>{error}</Text>
            <Button mt={12} variant="white" fullWidth onClick={() => void refreshCity(city.id, { maxAgeMs: 0 })}>{t('common.tryAgain')}</Button>
          </>
        )}
      </Box>
      <Stack mx={12} mt={24} gap="sm">
        <Button size="lg" fullWidth onClick={() => { setEditing(true); }}>
          {record === undefined ? t('offline.enterToday') : t('offline.editToday')}
        </Button>
        <Button className="glass" variant="default" size="lg" fullWidth rightSection={<Icon name="arrow" size={18} />}
          onClick={() => { void navigate(paths.history(city.id)); }}>
          {t('city.historyButton', { logged: t('common.daysLogged', { count: logged }) })}
        </Button>
      </Stack>
      <Text px={20} py={20} fz={12} c="dimmed">{t(error === null ? 'offline.footer' : 'offline.footerOnline')}</Text>
      <DayEntryForm cityId={city.id} date={today} opened={editing} onClose={() => { setEditing(false); }} />
    </>
  );
}
