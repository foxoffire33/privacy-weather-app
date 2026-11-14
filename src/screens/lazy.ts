import { lazy } from 'react';

const loaders = {
  cities: async () => import('./Cities'),
  dayView: async () => import('./DayView'),
  history: async () => import('./History'),
  home: async () => import('./Home'),
  hourly: async () => import('./Hourly'),
  onboarding: async () => import('./Onboarding'),
  search: async () => import('./Search'),
  settings: async () => import('./Settings'),
};

export const Cities = lazy(async () => {
  const { Cities: screen } = await loaders.cities();
  return { default: screen };
});
export const DayView = lazy(async () => {
  const { DayView: screen } = await loaders.dayView();
  return { default: screen };
});
export const History = lazy(async () => {
  const { History: screen } = await loaders.history();
  return { default: screen };
});
export const Home = lazy(async () => {
  const { Home: screen } = await loaders.home();
  return { default: screen };
});
export const Hourly = lazy(async () => {
  const { Hourly: screen } = await loaders.hourly();
  return { default: screen };
});
export const Onboarding = lazy(async () => {
  const { Onboarding: screen } = await loaders.onboarding();
  return { default: screen };
});
export const Search = lazy(async () => {
  const { Search: screen } = await loaders.search();
  return { default: screen };
});
export const Settings = lazy(async () => {
  const { Settings: screen } = await loaders.settings();
  return { default: screen };
});

export function preloadScreens(): void {
  for (const load of Object.values(loaders)) { void load(); }
}
