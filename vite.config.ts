import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative asset paths so the build runs from any folder and inside the Capacitor WebView.
export default defineConfig({
  base: './',
  plugins: [react({ babel: { plugins: ['babel-plugin-react-compiler'] } })],
  worker: { format: 'es' },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/stores/core/**', 'src/backup/**', 'src/stores/settingsSchema.ts', 'src/stores/entities/validation.ts'],
      exclude: ['**/__tests__/**'],
      thresholds: {
        branches: 75,
        statements: 80,
        lines: 85,
        functions: 80,
        'src/backup/**': { branches: 85 },
      },
    },
  },
});
