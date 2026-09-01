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
    fetchAudits: vi.fn(),
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
    vi.mocked(catalog.search).mockResolvedValue({ skills: [], semanticUnavailable: false });
    vi.mocked(catalog.fetchDetail).mockResolvedValue({
      skillId: '',
      pageSnapshot: null,
      pageScrapedAt: null,
      repository: null,
      source: null,
      installCount: null,
      sourceUrl: null,
      installSeries: [],
      enrichment: null,
      related: [],
    });
    vi.mocked(catalog.fetchAudits).mockResolvedValue({
      skillId: '',
      audits: null,
      source: 'cache',
      auditsFetchedAt: null,
    });
  });

  it('defaults to trending and requests that leaderboard', async () => {
    render(<SkillsDashboardView />);

    expect(screen.getByRole('radio', { name: 'Trending' })).toHaveAttribute('data-state', 'on');
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

    expect(screen.getByTestId('discovery-skill-container')).toHaveAttribute('data-layout', 'list');
  });

  it('shows category counts and filters both layouts with one active category', async () => {
    const user = userEvent.setup();
    render(<SkillsDashboardView />);

    expect(await screen.findByText('Find Skills')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('data-state', 'on');
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Git & GitHub/ })).toHaveTextContent('1');
    });
    expect(screen.getByRole('radio', { name: /DevOps & Cloud/ })).toHaveTextContent('0');

    const gitCategory = screen.getByRole('radio', { name: /Git & GitHub/ });
    await user.click(gitCategory);

    expect(screen.getByText('Find Skills')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Design')).not.toBeInTheDocument();
    expect(gitCategory).toHaveAttribute('data-state', 'on');

    await user.click(screen.getByRole('radio', { name: 'List' }));
    expect(screen.getByTestId('discovery-skill-container')).toHaveAttribute('data-layout', 'list');
    expect(screen.getByText('Find Skills')).toBeInTheDocument();

    await user.click(gitCategory);
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByText('Frontend Design')).toBeInTheDocument();
  });

  it('opens skill detail in a dialog when a card is clicked', async () => {
    MotionGlobalConfig.skipAnimations = true;

    try {
      render(<SkillsDashboardView />);

      const title = await screen.findByText('Find Skills');
      const trigger = title.closest('[aria-haspopup="dialog"]');
      expect(trigger).toBeTruthy();
      // jsdom flex/scroll layout makes userEvent pointer-events checks fail; fireEvent is reliable here.
      if (!(trigger instanceof HTMLElement)) {
        throw new Error('expected dialog trigger');
      }
      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.getByText('Loading skill details...')).toBeInTheDocument();
    } finally {
      MotionGlobalConfig.skipAnimations = false;
    }
  });

  it('shows local cache hits immediately and Searching while the API is outstanding', async () => {
    let resolveSearch!: (value: {
      skills: typeof MOCK_LEADERBOARD;
      semanticUnavailable: boolean;
    }) => void;
    vi.mocked(catalog.search).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<SkillsDashboardView />);

    expect(await screen.findByText('Find Skills')).toBeInTheDocument();
    expect(screen.getByText('Frontend Design')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Search skills' }), 'find');

    expect(screen.getByText('Find Skills')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Design')).not.toBeInTheDocument();
    expect(screen.getByText('Searching…')).toBeInTheDocument();

    await waitFor(() => {
      expect(catalog.search).toHaveBeenCalledWith('find', 50, []);
    });
    expect(screen.getByText('Searching…')).toBeInTheDocument();

    resolveSearch({
      skills: [
        {
          id: 'api-only/skills/extra',
          slug: 'extra',
          name: 'Extra API Skill',
          source: 'api-only/skills',
          installs: 9,
          sourceType: 'github',
          url: 'https://skills.sh/api-only/skills/extra',
        },
      ],
      semanticUnavailable: false,
    });

    expect(await screen.findByText('Extra API Skill')).toBeInTheDocument();
    expect(screen.getByText('Find Skills')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
    });
  });

  it('shows a warning when semantic search falls back to keyword results', async () => {
    vi.mocked(catalog.search).mockResolvedValue({
      skills: MOCK_LEADERBOARD.slice(0, 1),
      semanticUnavailable: true,
    });

    const user = userEvent.setup();
    render(<SkillsDashboardView />);

    await user.type(screen.getByRole('textbox', { name: 'Search skills' }), 'find');

    expect(await screen.findByText('Semantic results are unavailable')).toBeInTheDocument();
    expect(screen.getByText('Showing matching keyword results only.')).toBeInTheDocument();
  });

  it('narrows the search by the selected category facet', async () => {
    const user = userEvent.setup();
    render(<SkillsDashboardView />);

    expect(await screen.findByText('Find Skills')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search skills' }), 'find');

    expect(screen.getByText('Find Skills')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Git & GitHub/ }));

    await waitFor(() => {
      expect(catalog.search).toHaveBeenCalledWith('find', 50, ['git-github']);
    });
    // The verified cached hit remains visible while the API contributes semantic matches.
    await waitFor(() => {
      expect(screen.getByText('Find Skills')).toBeInTheDocument();
    });
  });

  it('clears search and restores the unfiltered active leaderboard', async () => {
    const user = userEvent.setup();
    render(<SkillsDashboardView />);

    expect(await screen.findByText('Find Skills')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search skills' }), 'find');
    expect(screen.queryByText('Frontend Design')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByText('Find Skills')).toBeInTheDocument();
    expect(screen.getByText('Frontend Design')).toBeInTheDocument();
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
  });
});
