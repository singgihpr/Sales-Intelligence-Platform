import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test-setup.js',
        'src/test-utils.jsx',
        '**/*.test.{js,jsx}',
        '**/*.config.{js,ts}',
        'scripts/',
        'netlify/',
        'dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'virtual:pwa-register/react': resolve(__dirname, 'src/__mocks__/pwa-register.js'),
    },
  },
});
