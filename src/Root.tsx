import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { useMemo } from 'react';

import App from './App';
import { useSettings } from './stores';
import { buildTheme, CONFIRM_MODAL } from './theme';

export function Root() {
  const { accent, accentColor } = useSettings();
  const theme = useMemo(() => buildTheme(accent, accentColor), [accent, accentColor]);
  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <ModalsProvider modalProps={CONFIRM_MODAL}>
        <App />
      </ModalsProvider>
    </MantineProvider>
  );
}
