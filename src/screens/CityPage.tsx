import { Box, Button, VisuallyHidden } from '@mantine/core';
import { useLongPress } from '@mantine/hooks';
import { Suspense, memo, useDeferredValue } from 'react';
import { useNavigate } from 'react-router';

import { AirSection, PollenSection } from '../components/city/AirSections';
import { CityHero, CityTitle } from '../components/city/CityHero';
import { FeelsSection, PrecipSection, SunSection, WindSection } from '../components/city/ConditionSections';
import { Next48Section, Next7Section } from '../components/city/ForecastCharts';
import { OfflineCity } from '../components/city/OfflineCity';
import { OverviewCard } from '../components/city/OverviewCard';
import { AtmosphereSection, CityFooter, SeaSection, SkySection } from '../components/city/SkySections';
import { Icon } from '../components/Icon';
import { CityBodySk, Sk } from '../components/Skeletons';
import { t } from '../i18n';
import { useForecastData, useForecastQuery, useLogCount, useSettings, useUnits } from '../stores';
import { useUiStore } from '../stores/uiStore';
import { completeOrder } from '../utils/citySections';
import { paths } from '../utils/paths';

import type { CityPageProps, CitySectionProps } from '../types';
import type { ReactElement } from 'react';

const LONG_PRESS_MS = 600;

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
  const chartEntry = useDeferredValue(entry);
  const order = completeOrder(useUiStore((st) => st.sectionOrder));
  if (offline || !entry) {
    return <OfflineCity city={city} isDefault={isDefault} error={offline ? null : query.error} />;
  }
  const data = { city, entry, units };
  const charts = { city, entry: chartEntry ?? entry, units };
  return (
    <>
      <CityHero {...data} isDefault={isDefault} />

      {order.map((id, i) => <CitySection key={id} id={id} {...charts} liveEntry={entry} expanded={expanded} first={i === 0} />)}

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

function CitySection({ id, city, entry, units, liveEntry, expanded, first }: CitySectionProps): ReactElement {
  switch (id) {
    case 'overview': { return <OverviewCard city={city} entry={liveEntry} units={units} expanded={expanded} first={first} />; }
    case 'next48': { return <Next48Section city={city} entry={entry} units={units} />; }
    case 'next7': { return <Next7Section city={city} entry={entry} units={units} />; }
    case 'feels': { return <FeelsSection entry={entry} units={units} />; }
    case 'sun': { return <SunSection entry={entry} units={units} />; }
    case 'precip': { return <PrecipSection entry={entry} units={units} />; }
    case 'wind': { return <WindSection entry={entry} units={units} />; }
    case 'air': { return <AirSection entry={entry} />; }
    case 'pollen': { return <PollenSection entry={entry} />; }
    case 'sky': { return <SkySection entry={entry} />; }
    case 'atmosphere': { return <AtmosphereSection entry={entry} />; }
    case 'sea': { return <SeaSection entry={entry} units={units} />; }
  }
}

function longPressAllowed(target: EventTarget): boolean {
  return !(target instanceof Element) || target.closest('[data-noswipe], button, a, input, textarea, [role=slider], .recharts-wrapper') === null;
}

function CityPageView({ city, isDefault }: CityPageProps): ReactElement {
  const busy = useForecastQuery(city.id).status === 'loading';
  const openOrder = useUiStore((st) => st.setSectionOrderOpen);
  const longPress = useLongPress((event) => { if (longPressAllowed(event.target)) { openOrder(true); } }, { threshold: LONG_PRESS_MS, cancelOnMove: true });
  return (
    <Box className="page" {...longPress}>
      <Suspense fallback={<CityPageSk city={city} isDefault={isDefault} />}>
        <CityPageContent city={city} isDefault={isDefault} />
      </Suspense>
      {busy && <VisuallyHidden role="status">{t('city.updatingCity', { name: city.name })}</VisuallyHidden>}
    </Box>
  );
}

export const CityPage = memo(CityPageView);
