import { createContext, use } from 'react';

export const ScreenSettledContext = createContext(true);

export function useScreenSettled(): boolean {
  return use(ScreenSettledContext);
}
