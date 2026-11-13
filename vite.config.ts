import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths so the build runs from any folder and inside the Capacitor WebView.
export default defineConfig({ base: './', plugins: [react()] });
