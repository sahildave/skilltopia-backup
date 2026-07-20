import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './i18n'
import { queryClient } from './lib/query-client'
import { WebThemeProvider } from './components/WebThemeProvider'
import { WebErrorBoundary } from './components/WebErrorBoundary'
import { WebShell } from './components/layout/WebShell'
import './App.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <WebErrorBoundary>
      <WebThemeProvider>
        <WebShell />
      </WebThemeProvider>
    </WebErrorBoundary>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
)
