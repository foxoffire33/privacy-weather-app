import { App as CapApp } from '@capacitor/app';
import { Fragment, useEffect } from 'react';
import { Box, Center, Loader } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { refreshAll, useCityStore, useHydrated, useSettings } from './storesV2';
import { useUiStore } from './store/uiStore';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { Cities } from './screens/Cities';
import { Search } from './screens/Search';
import { History } from './screens/History';
import { Hourly } from './screens/Hourly';
import { DayView } from './screens/DayView';
import { Settings } from './screens/Settings';
import { syncAppIcon } from './lib/appIcon';
import { startWidgetSync } from './lib/widgets';
import { useI18n } from './i18n';

export default function App() {
  const hydrated = useHydrated();
  const { snapshotMinutes, accent, accentColor, language } = useSettings();
  const route = useUiStore((s) => s.route);
  const hasCities = useCityStore((s) => s.cityIds.length > 0);
  const { lang, i18nReady, setLanguage } = useI18n(useShallow((s) => ({ lang: s.lang, i18nReady: s.ready, setLanguage: s.setLanguage })));
  useEffect(() => {
    if (hydrated) void setLanguage(language);
  }, [hydrated, language, setLanguage]);
  useEffect(() => {
    if (!hydrated) return;
    void refreshAll({ maxAgeMs: 0 });
    const timer = window.setInterval(() => void refreshAll({ maxAgeMs: 0 }), snapshotMinutes * 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshAll({ maxAgeMs: 0 }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [hydrated, snapshotMinutes]);
  useEffect(() => {
    if (hydrated) syncAppIcon(accent, accentColor);
  }, [hydrated, accent, accentColor]);
  useEffect(() => (hydrated ? startWidgetSync() : undefined), [hydrated]);
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => {
      const { route: r, stack, back } = useUiStore.getState();
      if (r.name === 'home' && !stack.length) void CapApp.exitApp();
      else back();
    });
    return () => { void sub.then((h) => h.remove()); };
  }, []);
  let screen;
  if (!hydrated || !i18nReady) screen = <Center flex={1}><Loader /></Center>;
  else if (!hasCities && route.name !== 'search' && route.name !== 'settings') screen = <Onboarding />;
  else if (route.name === 'cities') screen = <Cities />;
  else if (route.name === 'search') screen = <Search />;
  else if (route.name === 'settings') screen = <Settings />;
  else if (route.name === 'history') screen = <History cityId={route.cityId} />;
  else if (route.name === 'hourly') screen = <Hourly cityId={route.cityId} />;
  else if (route.name === 'day') screen = <DayView cityId={route.cityId} date={route.date} />;
  else screen = <Home />;
  const topAccent = hydrated && (route.name === 'home' || (!hasCities && route.name !== 'search' && route.name !== 'settings'));
  return <Box className="stage"><Box className="device" data-accent={accent} data-top={topAccent ? 'accent' : undefined}><Fragment key={lang}>{screen}</Fragment></Box></Box>;
}
