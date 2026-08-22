import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import type { ScannedSkill } from '@/platform/types';
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';

const pluginSkill = (marketplace: string, version: string): ScannedSkill => ({
  name: 'ponytail',
  uninstallName: 'ponytail',
  description: 'Laziest solution that works',
  scope: 'global',
  providerIds: [],
  origins: [{ kind: 'claudePlugin' as const, plugin: 'ponytail', marketplace, version }],
  paths: [{ path: '/Users/mock/.claude/plugins/cache/ponytail/skills/ponytail' }],
});

const platformMock = vi.hoisted(() => ({
  hasLocalLibrary: true as boolean,
  copiesInstallCommand: false,
  uninstall: vi.fn(),
  copySkillToProviders: vi.fn(),
}));

vi.mock('@platform', () => ({
  platform: {
    get hasLocalLibrary() {
      return platformMock.hasLocalLibrary;
    },
    get copiesInstallCommand() {
      return platformMock.copiesInstallCommand;
    },
    uninstall: (...args: unknown[]) => platformMock.uninstall(...args),
    copySkillToProviders: (...args: unknown[]) => platformMock.copySkillToProviders(...args),
  },
}));

describe('SkillCardOverflowMenu', () => {
  beforeEach(() => {
    platformMock.hasLocalLibrary = true;
    platformMock.copiesInstallCommand = false;
    platformMock.uninstall.mockClear();
    platformMock.uninstall.mockResolvedValue({ results: [] });
  });

  it('shows Copy to other providers when the platform has a local library', async () => {
    const user = userEvent.setup();
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;

    render(
      <SkillCardOverflowMenu
        skill={skill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
        reduceMotion
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Installed$/ }));
    expect(screen.getByRole('menuitem', { name: /copy to other providers/i })).toBeInTheDocument();
  });

  it('swaps the pill for a busy state and closes the menu while uninstalling', async () => {
    const user = userEvent.setup();
    let settle: (() => void) | undefined;
    platformMock.uninstall.mockReturnValue(
      new Promise((resolve) => {
        settle = () => resolve({ results: [] });
      }),
    );
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;

    render(
      <SkillCardOverflowMenu
        skill={skill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
        reduceMotion
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Installed$/ }));
    await user.click(screen.getByRole('menuitem', { name: /^uninstall$/i }));
    await user.click(screen.getByRole('button', { name: /yes, uninstall/i }));

    expect(await screen.findByRole('button', { name: /uninstalling/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Installed$/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    settle?.();
    expect(await screen.findByRole('button', { name: /^Installed$/ })).toBeInTheDocument();
  });

  it('hides Copy to other providers when the platform has no local library', async () => {
    const user = userEvent.setup();
    platformMock.hasLocalLibrary = false;
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;

    render(
      <SkillCardOverflowMenu
        skill={skill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
        reduceMotion
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Installed$/ }));
    expect(
      screen.queryByRole('menuitem', { name: /copy to other providers/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /uninstall/i })).toBeInTheDocument();
  });

  // The plugin cache is read-only, so an uninstall could only ever fail.
  it('replaces Uninstall with the owning plugin for a plugin-only skill', async () => {
    const user = userEvent.setup();
    const skill = pluginSkill('official', '1.2.0');

    render(
      <SkillCardOverflowMenu
        skill={skill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
        reduceMotion
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Installed$/ }));
    const managed = screen.getByRole('menuitem', { name: /managed by ponytail@official/i });
    expect(managed).toBeDisabled();
    expect(screen.queryByRole('menuitem', { name: /^uninstall$/i })).not.toBeInTheDocument();

    await user.click(managed);
    expect(platformMock.uninstall).not.toHaveBeenCalled();
  });
});
