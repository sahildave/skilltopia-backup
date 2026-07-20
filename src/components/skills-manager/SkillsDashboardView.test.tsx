import { render, screen, waitFor } from '@/test/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { SkillsDashboardView } from './SkillsDashboardView';
import { catalog } from '@catalog';
import { MOCK_LEADERBOARD } from '@/catalog/fixtures';
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
});
