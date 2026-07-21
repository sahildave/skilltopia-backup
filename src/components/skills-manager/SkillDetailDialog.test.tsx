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
import { render, screen, waitFor } from '@/test/test-utils';
import { catalog } from '@catalog';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('shows loading then content when detail resolves', async () => {
    const skill = MOCK_LEADERBOARD[0];
    if (!skill) throw new Error('expected MOCK_LEADERBOARD[0]');

    let resolveDetail!: (value: typeof MOCK_DETAIL) => void;
    vi.mocked(catalog.fetchDetail).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        }),
    );
    vi.mocked(catalog.fetchAudits).mockResolvedValue(MOCK_AUDITS);

    await renderOpenDetail(skill);

    expect(screen.getByText(/loading skill details/i)).toBeInTheDocument();

    resolveDetail(MOCK_DETAIL);

    await waitFor(() => {
      expect(screen.getByText('Discover and install agent skills')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByText(/loading skill details/i)).not.toBeInTheDocument();
    });
  });

  it('renders page cache fields, sparkline series, and audits for a cached skill', async () => {
    const skill = MOCK_LEADERBOARD[0];
    if (!skill) throw new Error('expected MOCK_LEADERBOARD[0]');

    vi.mocked(catalog.fetchDetail).mockResolvedValue(MOCK_DETAIL);
    vi.mocked(catalog.fetchAudits).mockResolvedValue(MOCK_AUDITS);

    await renderOpenDetail(skill);

    await waitFor(() => {
      expect(screen.getByText('Discover and install agent skills')).toBeInTheDocument();
    });

    expect(screen.getByText('exploration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vercel-labs\/agent-skills/ })).toBeInTheDocument();
    expect(screen.getByText('128,000')).toBeInTheDocument();
    expect(screen.getByText('Socket')).toBeInTheDocument();
    expect(screen.getByText('No alerts')).toBeInTheDocument();
    expect(catalog.fetchAudits).toHaveBeenCalledWith(MOCK_DETAIL.skillId);
  });

  it('still requests on-demand audits when page cache is empty', async () => {
    const skill = MOCK_LEADERBOARD[1];
    if (!skill) throw new Error('expected MOCK_LEADERBOARD[1]');

    vi.mocked(catalog.fetchDetail).mockResolvedValue(MOCK_UNCACHED_DETAIL);
    vi.mocked(catalog.fetchAudits).mockResolvedValue({
      skillId: MOCK_UNCACHED_DETAIL.skillId,
      audits: null,
      source: 'upstream',
      auditsFetchedAt: null,
    });

    await renderOpenDetail(skill);

    expect(screen.getByRole('button', { name: /open on skills\.sh/i })).toBeInTheDocument();
    expect(catalog.fetchAudits).toHaveBeenCalledWith(MOCK_UNCACHED_DETAIL.skillId);

    await waitFor(() => {
      expect(screen.getByText(/no security audits are available/i)).toBeInTheDocument();
    });
  });
});
