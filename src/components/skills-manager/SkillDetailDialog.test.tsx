import { render, screen, waitFor } from '@/test/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { catalog } from '@catalog';
import {
  MOCK_AUDITS,
  MOCK_DETAIL,
  MOCK_LEADERBOARD,
  MOCK_UNCACHED_DETAIL,
} from '@/catalog/fixtures';
import {
  MorphingDialog,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogTrigger,
} from '@/components/ui/morphing-dialog';
import { SkillDetailBody } from './SkillDetailDialog';

vi.mock('@catalog', () => ({
  catalog: {
    fetchLeaderboard: vi.fn(),
    search: vi.fn(),
    fetchDetail: vi.fn(),
    fetchAudits: vi.fn(),
  },
}));

async function renderOpenDetail(skill: (typeof MOCK_LEADERBOARD)[number]) {
  const user = userEvent.setup();
  render(
    <MorphingDialog>
      <MorphingDialogTrigger>Open skill</MorphingDialogTrigger>
      <MorphingDialogContainer>
        <MorphingDialogContent>
          <SkillDetailBody skill={skill} />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>,
  );
  await user.click(screen.getByRole('button', { name: 'Open skill' }));
  return user;
}

describe('SkillDetailBody', () => {
  beforeEach(() => {
    vi.mocked(catalog.fetchDetail).mockReset();
    vi.mocked(catalog.fetchAudits).mockReset();
  });

  it('renders page cache fields, sparkline series, and audits for a cached skill', async () => {
    vi.mocked(catalog.fetchDetail).mockResolvedValue(MOCK_DETAIL);
    vi.mocked(catalog.fetchAudits).mockResolvedValue(MOCK_AUDITS);

    await renderOpenDetail(MOCK_LEADERBOARD[0]!);

    await waitFor(() => {
      expect(screen.getByText('Discover and install agent skills')).toBeInTheDocument();
    });

    expect(screen.getByText('exploration')).toBeInTheDocument();
    expect(screen.getByText('vercel-labs/agent-skills')).toBeInTheDocument();
    expect(screen.getByText('128,000')).toBeInTheDocument();
    expect(screen.getByText('Socket')).toBeInTheDocument();
    expect(screen.getByText('No alerts')).toBeInTheDocument();
    expect(screen.queryByText(/not been scraped/i)).not.toBeInTheDocument();
    expect(catalog.fetchAudits).toHaveBeenCalledWith(MOCK_DETAIL.skillId);
  });

  it('shows not-cached copy and still requests on-demand audits', async () => {
    vi.mocked(catalog.fetchDetail).mockResolvedValue(MOCK_UNCACHED_DETAIL);
    vi.mocked(catalog.fetchAudits).mockResolvedValue({
      skillId: MOCK_UNCACHED_DETAIL.skillId,
      audits: null,
      source: 'upstream',
      auditsFetchedAt: null,
    });

    await renderOpenDetail(MOCK_LEADERBOARD[1]!);

    await waitFor(() => {
      expect(screen.getByText(/not been scraped into the page cache/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /open on skills\.sh/i })).toBeInTheDocument();
    expect(catalog.fetchAudits).toHaveBeenCalledWith(MOCK_UNCACHED_DETAIL.skillId);

    await waitFor(() => {
      expect(screen.getByText(/no security audits are available/i)).toBeInTheDocument();
    });
  });
});
