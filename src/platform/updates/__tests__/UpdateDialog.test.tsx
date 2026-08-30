import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpdateDialog } from '../UpdateDialog';
import type { UpdateState } from '../types';
import { CANDIDATE } from './fake-source';

function renderDialog(
  state: UpdateState,
  overrides: Partial<Parameters<typeof UpdateDialog>[0]> = {},
) {
  const handlers = {
    onInstall: vi.fn(),
    onDismiss: vi.fn(),
    onRestart: vi.fn(),
    onRetry: vi.fn(),
  };
  render(<UpdateDialog state={state} open {...handlers} {...overrides} />);
  return handlers;
}

describe('UpdateDialog', () => {
  it('renders nothing while idle or closed', () => {
    const { unmount } = render(
      <UpdateDialog
        state={{ status: 'idle' }}
        open
        onInstall={vi.fn()}
        onDismiss={vi.fn()}
        onRestart={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    render(
      <UpdateDialog
        state={{ status: 'available', candidate: CANDIDATE, reason: 'manual' }}
        open={false}
        onInstall={vi.fn()}
        onDismiss={vi.fn()}
        onRestart={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows progress while checking', () => {
    renderDialog({ status: 'checking', reason: 'manual' });

    expect(screen.getByRole('dialog')).toHaveTextContent(/checking for updates/i);
    expect(screen.queryByRole('button', { name: /install update/i })).not.toBeInTheDocument();
  });

  it('reassures when up to date', () => {
    renderDialog({ status: 'upToDate', checkedAt: 0 });

    expect(screen.getByRole('dialog')).toHaveTextContent(/up to date/i);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('offers the available version and installs on click', async () => {
    const handlers = renderDialog({ status: 'available', candidate: CANDIDATE, reason: 'startup' });

    expect(screen.getByRole('dialog')).toHaveTextContent('1.2.0');
    await userEvent.click(screen.getByRole('button', { name: /install update/i }));
    expect(handlers.onInstall).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: /later/i }));
    expect(handlers.onDismiss).toHaveBeenCalledOnce();
  });

  it('shows a real percentage when the size is known', () => {
    renderDialog({
      status: 'downloading',
      candidate: CANDIDATE,
      progress: { downloadedBytes: 5 * 1024 * 1024, totalBytes: 10 * 1024 * 1024 },
    });

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('dialog')).toHaveTextContent('5.0 MB of 10.0 MB');
  });

  it('falls back to an indeterminate bar when the size is unknown', () => {
    renderDialog({
      status: 'downloading',
      candidate: CANDIDATE,
      progress: { downloadedBytes: 4096, totalBytes: null },
    });

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByRole('dialog')).toHaveTextContent(/downloading/i);
  });

  it('offers a restart once the install finished', async () => {
    const handlers = renderDialog({ status: 'readyToRestart', candidate: CANDIDATE });

    await userEvent.click(screen.getByRole('button', { name: /restart now/i }));
    expect(handlers.onRestart).toHaveBeenCalledOnce();
  });

  it('explains a failure in words and offers a retry', async () => {
    const handlers = renderDialog({
      status: 'failed',
      error: { code: 'signature', message: 'bad signature' },
      reason: 'manual',
    });

    expect(screen.getByRole('dialog')).toHaveTextContent(/signature check/i);
    expect(screen.getByRole('dialog')).not.toHaveTextContent('bad signature');

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(handlers.onRetry).toHaveBeenCalledOnce();
  });

  it('names each error code with its own message', () => {
    const { unmount } = render(
      <UpdateDialog
        state={{ status: 'failed', error: { code: 'network', message: '' }, reason: 'startup' }}
        open
        onInstall={vi.fn()}
        onDismiss={vi.fn()}
        onRestart={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(/connection/i);
    unmount();

    renderDialog({
      status: 'failed',
      error: { code: 'timeout', message: '' },
      reason: 'startup',
    });
    expect(screen.getByRole('dialog')).toHaveTextContent(/too long/i);
  });
});
