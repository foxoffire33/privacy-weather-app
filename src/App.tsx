import { App as CapApp } from '@capacitor/app';
import { Box } from '@mantine/core';
import { useDocumentVisibility, useInterval, usePrevious } from '@mantine/hooks';
import { Fragment, Suspense, useEffect, use } from 'react';

import { BootSkeleton } from './components/Skeletons';
import { useI18n } from './i18n';
import { syncAppIcon } from './lib/appIcon';
import { startWidgetSync } from './lib/widgets';
import { Cities } from './screens/Cities';
import { DayView } from './screens/DayView';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Hourly } from './screens/Hourly';
import { Onboarding } from './screens/Onboarding';
import { Search } from './screens/Search';
import { Settings } from './screens/Settings';
import { refreshAll, useCityStore, useSettings, hydrateAll } from './stores';
import { useUiStore } from './stores/uiStore';

function AppInner() {
  // Suspend on the boot skeleton until IndexedDB and the locale are ready — no spinner.
  use(hydrateAll());
  const { snapshotMinutes, accent, accentColor } = useSettings();
  const route = useUiStore((s) => s.route);
  const hasCities = useCityStore((s) => s.cityIds.length > 0);
  const lang = useI18n((s) => s.lang);
  useEffect(() => { void refreshAll({ maxAgeMs: 0 }); }, []);
  const { start: startRefresh, stop: stopRefresh } = useInterval(() => { void refreshAll({ maxAgeMs: 0 }); }, snapshotMinutes * 60_000);
  useEffect(() => {
    startRefresh();
    return stopRefresh;
  }, [startRefresh, stopRefresh]);
  const visibility = useDocumentVisibility();
  const wasVisible = usePrevious(visibility);
  useEffect(() => {
    if (visibility === 'visible' && wasVisible != null && wasVisible !== 'visible') {void refreshAll({ maxAgeMs: 0 });}
  }, [visibility]);
  useEffect(() => { syncAppIcon(accent, accentColor); }, [accent, accentColor]);
  useEffect(() => startWidgetSync(), []);
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => {
      const { route: r, stack, back } = useUiStore.getState();
      if (r.name === 'home' && stack.length === 0) {void CapApp.exitApp();}
      else {back();}
    });
    return () => { void sub.then(async (h) => h.remove()); };
  }, []);
  let screen;
  if (!hasCities && route.name !== 'search' && route.name !== 'settings') {screen = <Onboarding />;}
  else {switch (route.name) {
 case 'cities': {
 screen = <Cities />;
 break;
 }
 case 'search': {
 screen = <Search />;
 break;
 }
 case 'settings': {
 screen = <Settings />;
 break;
 }
 case 'history': {
 screen = <History cityId={route.cityId} />;
 break;
 }
 case 'hourly': {
 screen = <Hourly cityId={route.cityId} />;
 break;
 }
 case 'day': {
 screen = <DayView cityId={route.cityId} date={route.date} />;
 break;
 }
 default: { screen = <Home />;
 }
 }}
  const topAccent = route.name === 'home' || (!hasCities && route.name !== 'search' && route.name !== 'settings');
  // Key the screen by route so React remounts it on navigation: each screen starts at
  // scroll position 0 instead of inheriting the previous screen's scrollTop.
  return <Box className="stage"><Box className="device" data-accent={accent} data-top={topAccent ? 'accent' : undefined}><Fragment key={`${lang}:${JSON.stringify(route)}`}>{screen}</Fragment></Box></Box>;
}

export default function App() {
  return (
    <Suspense fallback={<BootSkeleton />}>
      <AppInner />
    </Suspense>
  );
}
