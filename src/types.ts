export type Route =
  | { name: 'home' }
  | { name: 'cities' }
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'history'; cityId: string }
  | { name: 'hourly'; cityId: string }
  | { name: 'day'; cityId: string; date: string };
