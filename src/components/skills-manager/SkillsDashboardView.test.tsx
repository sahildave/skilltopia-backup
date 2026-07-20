import { render, screen, waitFor } from '@/test/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { SkillsDashboardView } from './SkillsDashboardView';
import { catalog } from '@catalog';
import { MOCK_LEADERBOARD } from '@/catalog/fixtures';

vi.mock('@catalog', () => ({
  catalog: {
    fetchLeaderboard: vi.fn(),
    search: vi.fn(),
    fetchDetail: vi.fn(),
  },
}));

describe('SkillsDashboardView', () => {
  beforeEach(() => {
    vi.mocked(catalog.fetchLeaderboard).mockResolvedValue(MOCK_LEADERBOARD);
    vi.mocked(catalog.search).mockResolvedValue([]);
    vi.mocked(catalog.fetchDetail).mockResolvedValue({
      skillId: '',
      enrichment: null,
      related: [],
    });
  });

  it('renders all discovery rails and requests their matching views', async () => {
    render(<SkillsDashboardView />);

    expect(screen.getByRole('heading', { name: 'Top Installed' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trending' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hot' })).toBeInTheDocument();

    await waitFor(() => {
      expect(catalog.fetchLeaderboard).toHaveBeenCalledWith('all-time', 0, 12);
      expect(catalog.fetchLeaderboard).toHaveBeenCalledWith('trending', 0, 12);
      expect(catalog.fetchLeaderboard).toHaveBeenCalledWith('hot', 0, 12);
    });
  });

  it('keeps seeded skills visible when a leaderboard refresh fails', async () => {
    vi.mocked(catalog.fetchLeaderboard).mockRejectedValueOnce(new Error('offline'));

    render(<SkillsDashboardView />);

    expect(screen.getAllByText('Find Skills')).toHaveLength(3);
    expect(await screen.findAllByText('Refresh failed')).toHaveLength(1);
  });

  it('shows install actions on skill cards', async () => {
    render(<SkillsDashboardView />);

    expect(await screen.findAllByRole('button', { name: 'Install' })).not.toHaveLength(0);
  });

  it('navigates to a category list from Show more and back to Explore', async () => {
    const user = userEvent.setup();
    render(<SkillsDashboardView />);

    expect(await screen.findByRole('heading', { name: 'Top Installed' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Show more' })[0]!);

    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Top Installed' })).toBeInTheDocument();

    await waitFor(() => {
      expect(catalog.fetchLeaderboard).toHaveBeenCalledWith('all-time', 0, 100);
    });

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByRole('heading', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trending' })).toBeInTheDocument();
  });
});
