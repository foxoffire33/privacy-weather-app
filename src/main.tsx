import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';

import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import './styles/global.css';
import App from './App';
import { useSettings } from './stores';
import { buildTheme, CONFIRM_MODAL } from './theme';

import type { ReactElement } from 'react';

function Root(): ReactElement {
  const { accent, accentColor } = useSettings();
  const theme = useMemo(() => buildTheme(accent, accentColor), [accent, accentColor]);
  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <ModalsProvider modalProps={CONFIRM_MODAL}>
        <HashRouter>
          <App />
        </HashRouter>
      </ModalsProvider>
    </MantineProvider>
  );
}

const container = document.querySelector('#root');
if (container === null) { throw new Error('Missing #root element'); }

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
