import { StrictMode, useMemo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import './styles/global.css';
import { buildTheme } from './theme';
import { useWeatherStore } from './store';
import App from './App';

// The theme follows the accent setting in the store.
function ThemeRoot({ children }: { children: ReactNode }) {
  const accent = useWeatherStore((s) => s.settings.accent);
  const theme = useMemo(() => buildTheme(accent), [accent]);
  return <MantineProvider theme={theme} forceColorScheme="dark">{children}</MantineProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeRoot>
      <App />
    </ThemeRoot>
  </StrictMode>,
);
