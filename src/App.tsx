import { App as CapApp } from '@capacitor/app';
import { Box } from '@mantine/core';
import { Fragment, Suspense, use, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { ScreenTransition } from './components/ScreenTransition';
import { BootSk } from './components/Skeletons';
import { ensureLanguage, languageLoaded, resolveLanguage, useI18n } from './i18n';
import { syncAppIcon } from './native/appIcon';
import { allowLandscape } from './native/orientation';
import { startWidgetSync } from './native/widgets';
import { Cities } from './screens/Cities';
import { DayView } from './screens/DayView';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Hourly } from './screens/Hourly';
import { Onboarding } from './screens/Onboarding';
import { Search } from './screens/Search';
import { Settings } from './screens/Settings';
import { refreshAll, useCityStore, useHydration, useIsHydrated, useSettings } from './stores';
import { useUiStore } from './stores/uiStore';

import type { FrameProps, Route } from './types';
import type { ReactElement } from 'react';

export default function App(): ReactElement {
  return (
    <Frame>
      <Suspense fallback={<BootSk />}>
        <Screens />
      </Suspense>
    </Frame>
  );
}

function Frame({ children }: FrameProps) {
  const { accent } = useSettings();
  const hydrated = useIsHydrated();
  const route = useUiStore((s) => s.route);
  const hasCities = useCityStore((s) => s.cityIds.length > 0);
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => {
      const { route: r, stack, back, fullscreenChart, closeChart } = useUiStore.getState();
      if (fullscreenChart !== null) { closeChart(); }
      else if (r.name === 'home' && stack.length === 0) { void CapApp.exitApp(); }
      else { back(); }
    });
    return () => { void sub.then(async (h) => h.remove()); };
  }, []);
  const topAccent = !hydrated || route.name === 'home' || (!hasCities && route.name !== 'search' && route.name !== 'settings');
  return (
    <Box className="stage">
      <Box className="device" data-accent={accent} data-top={topAccent ? 'accent' : undefined}>{children}</Box>
    </Box>
  );
}

function Screens() {
  useHydration();
  const { snapshotMinutes, accent, accentColor, language } = useSettings();
  const wanted = resolveLanguage(language);
  const { lang, ready } = useI18n(useShallow((s) => ({ lang: s.lang, ready: s.ready })));
  use(ready && lang === wanted ? languageLoaded(wanted) : ensureLanguage(wanted));
  const route = useUiStore((s) => s.route);
  const hasCities = useCityStore((s) => s.cityIds.length > 0);
  useEffect(() => {
    void refreshAll();
    const timer = globalThis.setInterval(() => void refreshAll({ maxAgeMs: 0 }), snapshotMinutes * 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') { void refreshAll(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { globalThis.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [snapshotMinutes]);
  const chartOpen = useUiStore((s) => s.fullscreenChart !== null);
  useEffect(() => { allowLandscape(chartOpen); }, [chartOpen]);
  useEffect(() => { syncAppIcon(accent, accentColor); }, [accent, accentColor]);
  useEffect(() => startWidgetSync(), []);
  const onboarding = !hasCities && route.name !== 'search' && route.name !== 'settings';
  return (
    <Fragment key={lang}>
      {onboarding ? <Onboarding /> : <ScreenTransition key={JSON.stringify(route)}>{screenFor(route)}</ScreenTransition>}
    </Fragment>
  );
}

function screenFor(route: Route) {
  switch (route.name) {
    case 'cities': { return <Cities />; }
    case 'search': { return <Search />; }
    case 'settings': { return <Settings />; }
    case 'history': { return <History cityId={route.cityId} />; }
    case 'hourly': { return <Hourly cityId={route.cityId} />; }
    case 'day': { return <DayView cityId={route.cityId} date={route.date} />; }
    case 'home': { return <Home />; }
  }
}
