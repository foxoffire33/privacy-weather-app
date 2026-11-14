export const paths = {
  home: '/',
  cities: '/cities',
  search: '/search',
  settings: '/settings',
  history: (cityId: string): string => `/city/${encodeURIComponent(cityId)}/history`,
  hourly: (cityId: string): string => `/city/${encodeURIComponent(cityId)}/hourly`,
  day: (cityId: string, date: string): string => `/city/${encodeURIComponent(cityId)}/day/${date}`,
};

export const BACK_STATE = { back: true };
