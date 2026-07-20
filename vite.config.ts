import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import packageJson from './package.json'

const host = process.env.TAURI_DEV_HOST
const target = (process.env.TARGET ?? 'web') as 'web' | 'desktop' | 'mock'
const port = Number(process.env.VITE_PORT) || 1420

const DEFAULT_BACKEND_PROXY_TARGET =
  process.env.SKILLS_PROXY_BASE_URL?.replace(/\/$/, '') ??
  'https://skills-explorer-six.vercel.app'

const isDesktop = target === 'desktop'
const appEntry =
  target === 'desktop' ? '/src/entry-desktop.tsx' : '/src/entry-web.tsx'

function htmlAppEntryPlugin(): Plugin {
  return {
    name: 'html-app-entry',
    transformIndexHtml(html) {
      return html.replaceAll('%APP_ENTRY%', appEntry)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_TARGET__: JSON.stringify(target),
  },
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
    htmlAppEntryPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@platform': path.resolve(
        __dirname,
        `./src/platform/index.${target}.ts`
      ),
      '@catalog': path.resolve(__dirname, `./src/catalog/index.${target}.ts`),
    },
  },
  build: {
    chunkSizeWarningLimit: 600, // Prevent warnings for template's bundled components
    rolldownOptions: {
      input: isDesktop
        ? {
            main: resolve(__dirname, 'index.html'),
            'quick-pane': resolve(__dirname, 'quick-pane.html'),
          }
        : {
            main: resolve(__dirname, 'index.html'),
          },
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: DEFAULT_BACKEND_PROXY_TARGET,
        changeOrigin: true,
        secure: true,
      },
    },
  },
}))
