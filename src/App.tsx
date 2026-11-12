import { App as CapApp } from '@capacitor/app';
import { Fragment, useEffect } from 'react';
import { Center, Loader } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from './store';
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
  const { hydrated, route, hasCities, snapshotMinutes, refreshAll, accent, accentColor, language } = useWeatherStore(useShallow((s) => ({
    hydrated: s.hydrated,
    route: s.route,
    hasCities: s.cities.length > 0,
    snapshotMinutes: s.settings.snapshotMinutes,
    refreshAll: s.refreshAll,
    accent: s.settings.accent,
    accentColor: s.settings.accentColor,
    language: s.settings.language,
  })));
  const { lang, i18nReady, setLanguage } = useI18n(useShallow((s) => ({ lang: s.lang, i18nReady: s.ready, setLanguage: s.setLanguage })));

  // Language: the device's, unless one is picked in Settings. Screens wait for its file.
  useEffect(() => {
    if (hydrated) void setLanguage(language);
  }, [hydrated, language, setLanguage]);

  // Cached data shows instantly; every open and every return to the foreground fetches fresh data.
  useEffect(() => {
    if (!hydrated) return;
    void refreshAll({ maxAgeMs: 0 });
    const timer = window.setInterval(() => void refreshAll({ maxAgeMs: 0 }), snapshotMinutes * 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshAll({ maxAgeMs: 0 }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [hydrated, snapshotMinutes, refreshAll]);

  // Launcher icon (Android) follows the accent colour.
  useEffect(() => {
    if (hydrated) syncAppIcon(accent, accentColor);
  }, [hydrated, accent, accentColor]);

  // Home-screen widgets (Android) follow the store.
  useEffect(() => (hydrated ? startWidgetSync() : undefined), [hydrated]);

  // Hardware/gesture back: step back through screens, close the app from the home screen.
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => {
      const { route: r, stack, back } = useWeatherStore.getState();
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

  return <div className="stage"><div className="device" data-accent={accent} data-top={topAccent ? 'accent' : undefined}><Fragment key={lang}>{screen}</Fragment></div></div>;
}
