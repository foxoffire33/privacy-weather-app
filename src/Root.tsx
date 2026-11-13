import { useMemo } from 'react';
import { MantineProvider } from '@mantine/core';
import { buildTheme } from './theme';
import { useSettings } from './stores';
import App from './App';

export function Root() {
  const { accent, accentColor } = useSettings();
  const theme = useMemo(() => buildTheme(accent, accentColor), [accent, accentColor]);
  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <App />
    </MantineProvider>
  );
}
