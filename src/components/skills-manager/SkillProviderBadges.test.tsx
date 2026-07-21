import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_INSTALLED_SCAN, MOCK_UNIVERSAL_ONLY_SCAN } from '@/platform/fixtures';
import { SkillProviderBadges } from './SkillProviderBadges';

describe('SkillProviderBadges', () => {
  it('renders Universal and aggregated provider badge with accessible tooltip names', async () => {
    const user = userEvent.setup();
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;

    render(<SkillProviderBadges skill={skill} snapshot={MOCK_INSTALLED_SCAN} />);

    expect(screen.getByText('Universal')).toBeInTheDocument();
    const providersBadge = screen.getByText('1 Provider');
    expect(providersBadge).toHaveAttribute('aria-label', '1 Provider: Claude Code');

    await user.hover(providersBadge);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Claude Code');
  });

  it('omits the providers badge for Universal-only skills', () => {
    const skill = MOCK_UNIVERSAL_ONLY_SCAN.skills[0];
    expect(skill).toBeDefined();
    if (!skill) return;

    render(<SkillProviderBadges skill={skill} snapshot={MOCK_UNIVERSAL_ONLY_SCAN} />);

    expect(screen.getByText('Universal')).toBeInTheDocument();
    expect(screen.queryByText(/Provider/)).not.toBeInTheDocument();
  });
});
