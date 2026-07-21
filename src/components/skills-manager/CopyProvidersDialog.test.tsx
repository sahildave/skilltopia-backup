import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_INSTALLED_SCAN, MOCK_UNIVERSAL_ONLY_SCAN } from '@/platform/fixtures';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { CopyProvidersDialog } from './CopyProvidersDialog';

const copyMock = vi.hoisted(() => ({
  copySkillToProviders: vi.fn(),
}));

vi.mock('@platform', () => ({
  platform: {
    hasLocalLibrary: true,
    copiesInstallCommand: false,
    copySkillToProviders: (...args: unknown[]) => copyMock.copySkillToProviders(...args),
    getInstalledScan: vi.fn(),
    scanInstalled: vi.fn(),
    revealProviderSkillsDir: vi.fn(),
    listInstalled: vi.fn(),
    listProviders: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
    openExternal: vi.fn(),
  },
}));

describe('CopyProvidersDialog', () => {
  beforeEach(() => {
    copyMock.copySkillToProviders.mockReset();
    copyMock.copySkillToProviders.mockResolvedValue({
      results: [{ providerId: 'claude-code', status: 'copied' }],
    });
    useInstalledScanStore.setState({
      snapshot: MOCK_INSTALLED_SCAN,
      error: null,
      refreshing: false,
    });
  });

  it('keeps submit disabled until a destination is selected', async () => {
    const user = userEvent.setup();
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;

    render(
      <CopyProvidersDialog
        skill={skill}
        snapshot={MOCK_INSTALLED_SCAN}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^copy$/i })).toBeDisabled();
    expect(screen.getByText(/select providers to copy/i)).toBeInTheDocument();
    expect(screen.getByText(/no available providers for this skill/i)).toBeInTheDocument();

    await user.click(screen.getByText(/already installed/i));
    expect(screen.getByRole('checkbox', { name: /claude code/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /claude code/i })).toBeChecked();
  });

  it('selects only Available providers with Copy all', async () => {
    const user = userEvent.setup();
    const skill = MOCK_UNIVERSAL_ONLY_SCAN.skills[0];
    expect(skill).toBeDefined();
    if (!skill) return;

    const snapshot = {
      ...MOCK_UNIVERSAL_ONLY_SCAN,
      providers: [
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.claude/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
      ],
      skills: [
        skill,
        {
          name: 'other-skill',
          uninstallName: 'other-skill',
          description: 'Other',
          scope: 'global' as const,
          providerIds: ['claude-code'],
          paths: [{ path: '/Users/mock/.claude/skills/other-skill' }],
        },
      ],
    };

    render(<CopyProvidersDialog skill={skill} snapshot={snapshot} open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: /copy all/i }));
    expect(screen.getByRole('checkbox', { name: /^claude code$/i })).toBeChecked();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeEnabled();
    expect(screen.getByText(/copying to 1 provider/i)).toBeInTheDocument();

    await user.click(screen.getByText(/other providers/i));
    expect(screen.getByRole('checkbox', { name: /^cursor$/i })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /^copy$/i }));
    expect(copyMock.copySkillToProviders).toHaveBeenCalledWith('frontend-design', ['claude-code']);
  });
});
