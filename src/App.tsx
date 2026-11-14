import { App as CapApp } from '@capacitor/app';
import { Box } from '@mantine/core';
import { modals, useModals } from '@mantine/modals';
import { MotionConfig } from 'motion/react';
import { Fragment, Suspense, use, useEffect, useEffectEvent } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { useShallow } from 'zustand/react/shallow';

import { ScreenTransition } from './components/ScreenTransition';
import { Splash } from './components/Splash';
import { ensureLanguage, languageLoaded, resolveLanguage, useI18n } from './i18n';
import { syncAppIcon } from './native/appIcon';
import { allowLandscape } from './native/orientation';
import { startWidgetSync } from './native/widgets';
import { Cities, DayView, History, Home, Hourly, Onboarding, preloadScreens, Search, Settings } from './screens/lazy';
import { refreshAll, useCityStore, useHydration, useIsHydrated, useSettings } from './stores';
import { useUiStore } from './stores/uiStore';
import { BACK_STATE, paths } from './utils/paths';

import type { CityRouteProps, FrameProps } from './types';
import type { ReactElement } from 'react';

const PRELOAD_DELAY = 1500;

export default function App(): ReactElement {
  return (
    <MotionConfig reducedMotion="user">
      <Frame>
        <Suspense fallback={<Splash />}>
          <Screens />
        </Suspense>
      </Frame>
    </MotionConfig>
  );
}

function onTopAccent(pathname: string, hydrated: boolean, hasCities: boolean): boolean {
  if (!hydrated || pathname === paths.home) { return true; }
  return !hasCities && pathname !== paths.search && pathname !== paths.settings;
}

function Frame({ children }: FrameProps) {
  const { accent } = useSettings();
  const hydrated = useIsHydrated();
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  const hasCities = useCityStore((s) => s.cityIds.length > 0);
  const openModals = useModals().modals.length;
  const onBack = useEffectEvent(() => {
    if (openModals > 0) { modals.closeAll(); return; }
    const { fullscreenChart, closeChart } = useUiStore.getState();
    if (fullscreenChart !== null) { closeChart(); return; }
    if (pathname === paths.home) { void CapApp.exitApp(); return; }
    if (key === 'default') { void navigate(paths.home, { replace: true, state: BACK_STATE }); return; }
    void navigate(-1);
  });
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => { onBack(); });
    return () => { void sub.then(async (h) => h.remove()); };
  }, []);
  return (
    <Box className="stage">
      <Box className="device" data-accent={accent} data-top={onTopAccent(pathname, hydrated, hasCities) ? 'accent' : undefined}>{children}</Box>
    </Box>
  );
}

function CityRoute({ screen }: CityRouteProps): ReactElement {
  const { cityId, date } = useParams();
  if (cityId === undefined) { return <Navigate to={paths.home} replace />; }
  if (screen === 'history') { return <History cityId={cityId} />; }
  if (screen === 'hourly') { return <Hourly cityId={cityId} />; }
  return date === undefined ? <Navigate to={paths.home} replace /> : <DayView cityId={cityId} date={date} />;
}

function Screens() {
  useHydration();
  const { snapshotMinutes, accent, accentColor, language } = useSettings();
  const wanted = resolveLanguage(language);
  const { lang, ready } = useI18n(useShallow((s) => ({ lang: s.lang, ready: s.ready })));
  use(ready && lang === wanted ? languageLoaded(wanted) : ensureLanguage(wanted));
  const location = useLocation();
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
  useEffect(() => { globalThis.setTimeout(preloadScreens, PRELOAD_DELAY); }, []);
  const onboarding = !hasCities && location.pathname !== paths.search && location.pathname !== paths.settings;
  return (
    <Fragment key={lang}>
      {onboarding ? <Onboarding /> : (
        <ScreenTransition>
          <Routes location={location}>
            <Route path={paths.home} element={<Home />} />
            <Route path={paths.cities} element={<Cities />} />
            <Route path={paths.search} element={<Search />} />
            <Route path={paths.settings} element={<Settings />} />
            <Route path="/city/:cityId/history" element={<CityRoute screen="history" />} />
            <Route path="/city/:cityId/hourly" element={<CityRoute screen="hourly" />} />
            <Route path="/city/:cityId/day/:date" element={<CityRoute screen="day" />} />
            <Route path="*" element={<Navigate to={paths.home} replace />} />
          </Routes>
        </ScreenTransition>
      )}
    </Fragment>
  );
}
