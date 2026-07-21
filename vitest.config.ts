import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    __APP_TARGET__: JSON.stringify('mock'),
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'api/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'src-tauri',
      '.git',
      '.cache',
      'build',
    ],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@platform': path.resolve(__dirname, './src/platform/index.mock.ts'),
      '@catalog': path.resolve(__dirname, './src/catalog/index.mock.ts'),
    },
  },
})
