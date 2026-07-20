import { fireEvent, render, screen, waitFor } from '@/test/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { SkillsDashboardView } from './SkillsDashboardView';
import { catalog } from '@catalog';
import { MOCK_LEADERBOARD } from '@/catalog/fixtures';
import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';

vi.mock('@catalog', () => ({
  catalog: {
    fetchLeaderboard: vi.fn(),
    search: vi.fn(),
    fetchDetail: vi.fn(),
  },
}));

describe('SkillsDashboardView', () => {
  beforeEach(() => {
    useInstalledSkillsUiStore.setState({ layoutMode: 'grid' });
    useInstalledScanStore.setState({
      snapshot: null,
      error: null,
      refreshing: false,
    });
    vi.mocked(catalog.fetchLeaderboard).mockResolvedValue(MOCK_LEADERBOARD);
    vi.mocked(catalog.search).mockResolvedValue([]);
    vi.mocked(catalog.fetchDetail).mockResolvedValue({
      skillId: '',
      enrichment: null,
      related: [],
    });
  });

  it('defaults to trending and requests that leaderboard', async () => {
    render(<SkillsDashboardView />);

    expect(screen.getByRole('radio', { name: 'Trending' })).toHaveAttribute(
      'data-state',
      'on',
    );
    expect(
      screen.getByRole('button', {
        name: 'Skills with sustained install growth over the past week.',
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(catalog.fetchLeaderboard).toHaveBeenCalledWith('trending', 0, 100);
    });
  });

  it('switches discovery view from the toolbar tabs', async () => {
    const user = userEvent.setup();
    render(<SkillsDashboardView />);

    await user.click(screen.getByRole('radio', { name: 'Hot' }));

    await waitFor(() => {
      expect(catalog.fetchLeaderboard).toHaveBeenCalledWith('hot', 0, 100);
    });

    expect(
      screen.queryByRole('button', {
        name: 'Skills with sustained install growth over the past week.',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Skills gaining the most installs in the last day or two.',
      }),
    ).toBeInTheDocument();
  });

  it('keeps seeded skills visible when a leaderboard refresh fails', async () => {
    vi.mocked(catalog.fetchLeaderboard).mockRejectedValueOnce(new Error('offline'));

    render(<SkillsDashboardView />);

    expect(screen.getByText('Find Skills')).toBeInTheDocument();
    expect(await screen.findByText('Refresh failed')).toBeInTheDocument();
  });

  it('shows install actions on skill cards', async () => {
    render(<SkillsDashboardView />);

    expect(await screen.findAllByRole('button', { name: 'Install' })).not.toHaveLength(0);
  });

  it('shows Installed instead of Install when a catalog skill matches the local scan', async () => {
    useInstalledScanStore.setState({ snapshot: MOCK_INSTALLED_SCAN });

    render(<SkillsDashboardView />);

    await waitFor(() => {
      expect(catalog.fetchLeaderboard).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: 'Installed' })).toHaveLength(2);
  });

  it('toggles list and grid layout from the toolbar', async () => {
    const user = userEvent.setup();
    render(<SkillsDashboardView />);

    const container = await screen.findByTestId('discovery-skill-container');
    expect(container).toHaveAttribute('data-layout', 'grid');

    await user.click(screen.getByRole('radio', { name: 'List' }));

    expect(screen.getByTestId('discovery-skill-container')).toHaveAttribute(
      'data-layout',
      'list',
    );
  });

  it('opens skill detail in a morphing dialog when a card is clicked', async () => {
    MotionGlobalConfig.skipAnimations = true;

    try {
      render(<SkillsDashboardView />);

      const title = await screen.findByText('Find Skills');
      const trigger = title.closest('[aria-haspopup="dialog"]');
      expect(trigger).toBeTruthy();
      // jsdom flex/scroll layout makes userEvent pointer-events checks fail; fireEvent is reliable here.
      fireEvent.click(trigger!);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
      expect(screen.getByText('Loading enrichment...')).toBeInTheDocument();
    } finally {
      MotionGlobalConfig.skipAnimations = false;
    }
  });
});
