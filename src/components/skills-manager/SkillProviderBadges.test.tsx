import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_INSTALLED_SCAN, MOCK_UNIVERSAL_ONLY_SCAN } from '@/platform/fixtures';
import type { ScannedSkill } from '@/platform/types';
import { SkillProviderBadges } from './SkillProviderBadges';

const pluginSkill = (marketplace: string, version: string): ScannedSkill => ({
  name: 'ponytail',
  uninstallName: 'ponytail',
  description: 'Laziest solution that works',
  scope: 'global',
  providerIds: [],
  origins: [{ kind: 'claudePlugin' as const, plugin: 'ponytail', marketplace, version }],
  paths: [{ path: '/Users/mock/.claude/plugins/cache/ponytail/skills/ponytail' }],
});

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

  it('marks a plugin-delivered skill with its own badge, naming the plugin and version', async () => {
    const user = userEvent.setup();
    const skill = pluginSkill('official', '1.2.0');

    render(<SkillProviderBadges skill={skill} snapshot={MOCK_INSTALLED_SCAN} />);

    const badge = screen.getByLabelText('Shipped by the Claude plugin ponytail@official');
    expect(badge).toHaveTextContent('ponytail');

    await user.hover(badge);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('1.2.0');
  });

  it('falls back to a translated placeholder when the plugin version is unknown', async () => {
    const user = userEvent.setup();
    const skill = pluginSkill('', '');

    render(<SkillProviderBadges skill={skill} snapshot={MOCK_INSTALLED_SCAN} />);

    await user.hover(screen.getByLabelText('Shipped by the Claude plugin ponytail'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('version unknown');
  });
});
