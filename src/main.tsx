import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import './styles/global.css';
import { Root } from './Root';

const container = document.querySelector('#root');
if (container === null) { throw new Error('Missing #root element'); }

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
