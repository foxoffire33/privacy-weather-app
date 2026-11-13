import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import './styles/global.css';
import { Root } from './Root';

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
