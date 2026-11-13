import { App as CapApp } from '@capacitor/app';
import { Fragment, Suspense, use, useEffect } from 'react';
import { Box } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { refreshAll, useCityStore, useHydration, useIsHydrated, useSettings } from './stores';
import { useUiStore } from './stores/uiStore';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { Cities } from './screens/Cities';
import { Search } from './screens/Search';
import { History } from './screens/History';
import { Hourly } from './screens/Hourly';
import { DayView } from './screens/DayView';
import { Settings } from './screens/Settings';
import { syncAppIcon } from './lib/appIcon';
import { allowLandscape } from './lib/orientation';
import { startWidgetSync } from './lib/widgets';
import { ensureLanguage, languageLoaded, resolveLanguage, useI18n } from './i18n';
import { BootSk } from './components/Skeletons';
import type { FrameProps } from './types';

export default function App() {
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
      if (fullscreenChart !== null) closeChart();
      else if (r.name === 'home' && !stack.length) void CapApp.exitApp();
      else back();
    });
    return () => { void sub.then((h) => h.remove()); };
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
    const timer = window.setInterval(() => void refreshAll({ maxAgeMs: 0 }), snapshotMinutes * 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [snapshotMinutes]);
  const chartOpen = useUiStore((s) => s.fullscreenChart !== null);
  useEffect(() => { allowLandscape(chartOpen); }, [chartOpen]);
  useEffect(() => { syncAppIcon(accent, accentColor); }, [accent, accentColor]);
  useEffect(() => startWidgetSync(), []);
  let screen;
  if (!hasCities && route.name !== 'search' && route.name !== 'settings') screen = <Onboarding />;
  else if (route.name === 'cities') screen = <Cities />;
  else if (route.name === 'search') screen = <Search />;
  else if (route.name === 'settings') screen = <Settings />;
  else if (route.name === 'history') screen = <History cityId={route.cityId} />;
  else if (route.name === 'hourly') screen = <Hourly cityId={route.cityId} />;
  else if (route.name === 'day') screen = <DayView cityId={route.cityId} date={route.date} />;
  else screen = <Home />;
  return <Fragment key={lang}>{screen}</Fragment>;
}
