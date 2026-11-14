import { Box, Button, Paper, Text, VisuallyHidden } from '@mantine/core';
import { Suspense, memo } from 'react';
import { useNavigate } from 'react-router';

import { AirSection, PollenSection } from '../components/city/AirSections';
import { CityHero, CityTitle } from '../components/city/CityHero';
import { FeelsSection, PrecipSection, SunSection, WindSection } from '../components/city/ConditionSections';
import { DayList } from '../components/city/DayList';
import { Next48Section, Next7Section } from '../components/city/ForecastCharts';
import { HourlyStrip, Nowcast } from '../components/city/HourlyStrip';
import { OfflineCity } from '../components/city/OfflineCity';
import { AtmosphereSection, CityFooter, SeaSection, SkySection } from '../components/city/SkySections';
import { Icon } from '../components/Icon';
import { CityBodySk, Sk } from '../components/Skeletons';
import { t } from '../i18n';
import { useForecastData, useForecastQuery, useLogCount, useSettings, useUnits } from '../stores';
import { useUiStore } from '../stores/uiStore';
import { rainOutlook, nowIndex } from '../utils/insights';
import { paths } from '../utils/paths';

import type { CityPageProps } from '../types';
import type { ReactElement } from 'react';

function CityPageSk({ city, isDefault }: CityPageProps): ReactElement {
  return (
    <>
      <Box className="hero">
        <CityTitle city={city} isDefault={isDefault} />
        <Sk w={200} h={143} mt={8} />
        <Sk w={180} h={22} mt={14} />
        <Sk w={260} h={14} mt={8} />
      </Box>
      <CityBodySk />
    </>
  );
}

function CityPageContent({ city, isDefault }: CityPageProps): ReactElement {
  const entry = useForecastData(city.id);
  const query = useForecastQuery(city.id);
  const units = useUnits();
  const offline = useSettings().offline;
  const logged = useLogCount(city.id);
  const expanded = useUiStore((st) => st.expandedDay[city.id] ?? null);
  const navigate = useNavigate();
  if (!entry) {
    return <OfflineCity city={city} isDefault={isDefault} error={offline ? null : query.error} />;
  }
  const data = { city, entry, units };
  return (
    <>
      <CityHero {...data} isDefault={isDefault} />

      <Paper className="glass" mx={12} mt={-36} pos="relative">
        <Box px={12} pt={12} pb={10} style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <Text fz={14} fw={800}>{rainOutlook(entry.data, nowIndex(entry.data))}</Text>
          <Nowcast entry={entry} />
        </Box>
        <HourlyStrip {...data} expanded={expanded} />
        <DayList {...data} expanded={expanded} />
      </Paper>

      <Next48Section {...data} />
      <Next7Section {...data} />
      <FeelsSection entry={entry} units={units} />
      <SunSection entry={entry} units={units} />
      <PrecipSection entry={entry} units={units} />
      <WindSection entry={entry} units={units} />
      <AirSection entry={entry} />
      <PollenSection entry={entry} />
      <SkySection entry={entry} />
      <AtmosphereSection entry={entry} />
      <SeaSection entry={entry} units={units} />

      <Box mx={12} mt={24}>
        <Button className="glass" variant="default" size="lg" fullWidth
          rightSection={<Icon name="arrow" size={18} />} onClick={() => { void navigate(paths.history(city.id)); }}>
          {t('city.historyButton', { logged: t('common.daysLogged', { count: logged }) })}
        </Button>
      </Box>

      <CityFooter city={city} entry={entry} loading={query.status === 'loading'} />
    </>
  );
}

function CityPageView({ city, isDefault }: CityPageProps): ReactElement {
  const busy = useForecastQuery(city.id).status === 'loading';
  return (
    <Box className="page">
      <Suspense fallback={<CityPageSk city={city} isDefault={isDefault} />}>
        <CityPageContent city={city} isDefault={isDefault} />
      </Suspense>
      {busy && <VisuallyHidden role="status">{t('city.updatingCity', { name: city.name })}</VisuallyHidden>}
    </Box>
  );
}

export const CityPage = memo(CityPageView);
