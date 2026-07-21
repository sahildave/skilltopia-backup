import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_INSTALLED_SCAN, MOCK_UNIVERSAL_ONLY_SCAN } from '@/platform/fixtures';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { CopyProvidersDialog } from './CopyProvidersDialog';

const copyMock = vi.hoisted(() => ({
  copySkillToProviders: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
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

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastMock.success(...args),
    warning: (...args: unknown[]) => toastMock.warning(...args),
    error: (...args: unknown[]) => toastMock.error(...args),
  },
}));

function snapshotWithAvailableProviders(): {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
} {
  const skill = MOCK_UNIVERSAL_ONLY_SCAN.skills[0];
  if (!skill) {
    throw new Error('expected frontend-design fixture skill');
  }

  return {
    skill,
    snapshot: {
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
        {
          id: 'codex',
          name: 'Codex',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.codex/skills',
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
          scope: 'global',
          providerIds: ['claude-code'],
          paths: [{ path: '/Users/mock/.claude/skills/other-skill' }],
        },
        {
          name: 'another-skill',
          uninstallName: 'another-skill',
          description: 'Another',
          scope: 'global',
          providerIds: ['codex'],
          paths: [{ path: '/Users/mock/.codex/skills/another-skill' }],
        },
      ],
    },
  };
}

describe('CopyProvidersDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    copyMock.copySkillToProviders.mockReset();
    copyMock.copySkillToProviders.mockResolvedValue({
      results: [{ providerId: 'claude-code', status: 'copied' }],
    });
    toastMock.success.mockReset();
    toastMock.warning.mockReset();
    toastMock.error.mockReset();
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
    expect(screen.getByRole('checkbox', { name: /^cursor$/i })).toBeInTheDocument();
    expect(screen.queryByText(/no available providers for this skill/i)).not.toBeInTheDocument();

    await user.click(screen.getByText(/already installed/i));
    expect(screen.getByRole('checkbox', { name: /claude code/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /claude code/i })).toBeChecked();
  });

  it('selects only Available providers with the group checkbox', async () => {
    const user = userEvent.setup();
    const { skill, snapshot } = snapshotWithAvailableProviders();
    const singleAvailable = {
      ...snapshot,
      providers: snapshot.providers.filter((p) => p.id === 'claude-code'),
      skills: snapshot.skills.filter((s) => s.name !== 'another-skill'),
    };

    render(
      <CopyProvidersDialog skill={skill} snapshot={singleAvailable} open onOpenChange={vi.fn()} />,
    );

    await user.click(screen.getByRole('checkbox', { name: /available providers/i }));
    expect(screen.getByRole('checkbox', { name: /^claude code$/i })).toBeChecked();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeEnabled();
    expect(screen.getByText(/copying to 1 provider/i)).toBeInTheDocument();

    await user.click(screen.getByText(/other providers/i));
    expect(screen.getByRole('checkbox', { name: /^cursor$/i })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /^copy$/i }));
    expect(copyMock.copySkillToProviders).toHaveBeenCalledWith('frontend-design', ['claude-code']);
  });

  it('shows indeterminate on Available providers when only some children are selected', async () => {
    const user = userEvent.setup();
    const { skill, snapshot } = snapshotWithAvailableProviders();

    render(<CopyProvidersDialog skill={skill} snapshot={snapshot} open onOpenChange={vi.fn()} />);

    const group = screen.getByRole('checkbox', { name: /available providers/i });
    expect(group).not.toBeChecked();
    expect(group).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('checkbox', { name: /^claude code$/i }));
    expect(group).toHaveAttribute('aria-checked', 'mixed');
    expect(group).toHaveAttribute('data-state', 'indeterminate');

    await user.click(group);
    expect(screen.getByRole('checkbox', { name: /^claude code$/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^codex$/i })).toBeChecked();
    expect(group).toBeChecked();

    await user.click(group);
    expect(screen.getByRole('checkbox', { name: /^claude code$/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^codex$/i })).not.toBeChecked();
    expect(group).toHaveAttribute('aria-checked', 'false');
  });

  it('closes, toasts success, and rescans after a full copy', async () => {
    const user = userEvent.setup();
    const { skill, snapshot } = snapshotWithAvailableProviders();
    const onOpenChange = vi.fn();
    const rescanSpy = vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();

    copyMock.copySkillToProviders.mockResolvedValue({
      results: [
        { providerId: 'claude-code', status: 'copied' },
        { providerId: 'codex', status: 'copied' },
      ],
    });

    render(
      <CopyProvidersDialog skill={skill} snapshot={snapshot} open onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole('checkbox', { name: /available providers/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => {
      expect(copyMock.copySkillToProviders).toHaveBeenCalledWith('frontend-design', [
        'claude-code',
        'codex',
      ]);
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/copied frontend-design to 2 providers/i),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(rescanSpy).toHaveBeenCalled();
  });

  it('toasts partial results with failing provider names and rescans', async () => {
    const user = userEvent.setup();
    const { skill, snapshot } = snapshotWithAvailableProviders();
    const onOpenChange = vi.fn();
    const rescanSpy = vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();

    copyMock.copySkillToProviders.mockResolvedValue({
      results: [
        { providerId: 'claude-code', status: 'copied' },
        { providerId: 'codex', status: 'conflict', message: 'Target already exists' },
      ],
    });

    render(
      <CopyProvidersDialog skill={skill} snapshot={snapshot} open onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole('checkbox', { name: /available providers/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => {
      expect(toastMock.warning).toHaveBeenCalled();
    });
    expect(toastMock.warning).toHaveBeenCalledWith(
      expect.stringMatching(/copied frontend-design to 1 providers; 1 had issues/i),
      expect.objectContaining({
        description: expect.stringMatching(/codex/i),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(rescanSpy).toHaveBeenCalled();
  });

  it('closes without rescanning when every target conflicts or fails', async () => {
    const user = userEvent.setup();
    const { skill, snapshot } = snapshotWithAvailableProviders();
    const onOpenChange = vi.fn();
    const rescanSpy = vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();

    copyMock.copySkillToProviders.mockResolvedValue({
      results: [
        { providerId: 'claude-code', status: 'conflict', message: 'Target already exists' },
        { providerId: 'codex', status: 'failed', message: 'Permission denied' },
      ],
    });

    render(
      <CopyProvidersDialog skill={skill} snapshot={snapshot} open onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole('checkbox', { name: /available providers/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringMatching(/couldn't copy frontend-design/i),
      expect.objectContaining({
        description: expect.stringMatching(/claude code.*codex|codex.*claude code/i),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(rescanSpy).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and skips rescan on unrecoverable command errors', async () => {
    const user = userEvent.setup();
    const { skill, snapshot } = snapshotWithAvailableProviders();
    const onOpenChange = vi.fn();
    const rescanSpy = vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();

    copyMock.copySkillToProviders.mockRejectedValue(new Error('Skill not found in scan'));

    render(
      <CopyProvidersDialog skill={skill} snapshot={snapshot} open onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole('checkbox', { name: /^claude code$/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringMatching(/couldn't copy frontend-design/i),
      expect.objectContaining({
        description: 'Skill not found in scan',
      }),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(rescanSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeEnabled();
  });
});
