import { useEffect } from 'react';
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

export default function App() {
  const { hydrated, route, hasCities, snapshotMinutes, refreshAll, accent } = useWeatherStore(useShallow((s) => ({
    hydrated: s.hydrated,
    route: s.route,
    hasCities: s.cities.length > 0,
    snapshotMinutes: s.settings.snapshotMinutes,
    refreshAll: s.refreshAll,
    accent: s.settings.accent,
  })));

  // Cached data shows instantly; every open and every return to the foreground fetches fresh data.
  useEffect(() => {
    if (!hydrated) return;
    void refreshAll({ maxAgeMs: 0 });
    const timer = window.setInterval(() => void refreshAll({ maxAgeMs: 0 }), snapshotMinutes * 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshAll({ maxAgeMs: 0 }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [hydrated, snapshotMinutes, refreshAll]);

  let screen;
  if (!hydrated) screen = <Center flex={1}><Loader /></Center>;
  else if (!hasCities && route.name !== 'search' && route.name !== 'settings') screen = <Onboarding />;
  else if (route.name === 'cities') screen = <Cities />;
  else if (route.name === 'search') screen = <Search />;
  else if (route.name === 'settings') screen = <Settings />;
  else if (route.name === 'history') screen = <History cityId={route.cityId} />;
  else if (route.name === 'hourly') screen = <Hourly cityId={route.cityId} />;
  else if (route.name === 'day') screen = <DayView cityId={route.cityId} date={route.date} />;
  else screen = <Home />;

  return <div className="stage"><div className="device" data-accent={accent}>{screen}</div></div>;
}
