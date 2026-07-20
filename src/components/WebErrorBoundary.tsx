import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';

interface Props extends WithTranslation {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/** Browser error boundary — no Tauri recovery / filesystem. */
class WebErrorBoundaryBase extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Application crashed', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  override render() {
    const { t } = this.props;

    if (this.state.hasError) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-xl font-semibold">{t('web.error.title')}</h1>
          <p className="text-muted-foreground max-w-md text-sm text-pretty">
            {this.state.error?.message ?? t('toast.error.generic')}
          </p>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm"
            onClick={() => window.location.reload()}
          >
            {t('web.error.reload')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const WebErrorBoundary = withTranslation()(WebErrorBoundaryBase);
