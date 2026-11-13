import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { useMemo } from 'react';

import App from './App';
import { useSettings } from './stores';
import { buildTheme } from './theme';

export function Root() {
  const { accent, accentColor } = useSettings();
  const theme = useMemo(() => buildTheme(accent, accentColor), [accent, accentColor]);
  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <style>{theme.other!.globalCss}</style>
      <ModalsProvider>
        <App />
      </ModalsProvider>
    </MantineProvider>
  );
}
