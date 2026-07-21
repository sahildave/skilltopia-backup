import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';

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

    await user.click(screen.getByRole('button', { name: /skill actions/i }));
    expect(screen.getByRole('menuitem', { name: /copy to other providers/i })).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /skill actions/i }));
    expect(
      screen.queryByRole('menuitem', { name: /copy to other providers/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /uninstall/i })).toBeInTheDocument();
  });
});
