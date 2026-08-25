import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  debug as logDebug,
  error as logError,
  info as logInfo,
  trace as logTrace,
  warn as logWarn,
} from '@tauri-apps/plugin-log';
import './i18n';
import App from './App';
import { logger } from './lib/logger';
import { queryClient } from './lib/query-client';

const desktopLoggers = {
  trace: logTrace,
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
};

logger.setSink(({ level, message, context }) => {
  const keyValues = context
    ? Object.fromEntries(
        Object.entries(context).map(([key, value]) => [
          key,
          value instanceof Error ? (value.stack ?? value.message) : String(value),
        ]),
      )
    : undefined;
  void desktopLoggers[level](message, { keyValues }).catch(() => undefined);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>,
);
