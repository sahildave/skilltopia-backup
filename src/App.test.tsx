import { act, render, screen } from '@/test/test-utils';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { check } from '@tauri-apps/plugin-updater';
import App from './App';
import { PERIODIC_INTERVAL_MS, STARTUP_DELAY_MS, useUpdateStore } from './platform/updates';

// Tauri bindings are mocked globally in src/test/setup.ts

describe('App', () => {
  it('renders main window layout', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: /explore/i })).toBeInTheDocument();
  });

  it('renders title bar with traffic light buttons', () => {
    render(<App />);
    // Find specifically the window control buttons in the title bar
    const titleBarButtons = screen
      .getAllByRole('button')
      .filter(
        (button) =>
          button.getAttribute('aria-label')?.includes('window') ||
          button.className.includes('window-control'),
      );
    // Should have at least the window control buttons
    expect(titleBarButtons.length).toBeGreaterThan(0);
  });
});

describe('App updates', () => {
  beforeEach(() => {
    useUpdateStore.setState({ state: { status: 'idle' }, dialogOpen: false, controller: null });
    vi.mocked(check).mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function runStartupCheck() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS);
    });
  }

  it('shows the update dialog when the scheduled startup check finds a version', async () => {
    vi.mocked(check).mockResolvedValue({
      version: '9.9.9',
      currentVersion: '1.0.0',
      body: undefined,
      date: undefined,
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof check>>);

    render(<App />);
    await runStartupCheck();

    expect(await screen.findByRole('dialog', { name: /9\.9\.9/ })).toBeInTheDocument();
  });

  it('stays usable and silent when the startup check fails offline', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => false);
    vi.mocked(check).mockRejectedValue(new Error('error sending request: network unreachable'));

    render(<App />);
    await runStartupCheck();

    expect(useUpdateStore.getState().state).toMatchObject({ status: 'failed', reason: 'startup' });
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: /explore/i })).toBeInTheDocument();

    alertSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('stops checking once the shell unmounts', async () => {
    vi.mocked(check).mockResolvedValue(null);

    const { unmount } = render(<App />);
    await runStartupCheck();
    expect(check).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PERIODIC_INTERVAL_MS * 2);
    });

    expect(check).toHaveBeenCalledTimes(1);
    expect(useUpdateStore.getState().controller).toBeNull();
  });
});
