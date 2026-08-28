import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { act, render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyProviderSkillsDialog } from './CopyProviderSkillsDialog';

const copyMock = vi.hoisted(() => ({
  copyProviderSkills: vi.fn(),
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
    copyProviderSkills: (...args: unknown[]) => copyMock.copyProviderSkills(...args),
    copySkillToProviders: vi.fn(),
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

const CLAUDE_DIR = '/Users/mock/.claude/skills';
const CODEX_DIR = '/Users/mock/.codex/skills';

function skill(name: string, providerIds: string[], paths: ScannedSkill['paths']): ScannedSkill {
  return {
    name,
    uninstallName: name,
    description: `${name} description`,
    scope: 'global',
    providerIds,
    origins: providerIds.map((providerId) => ({
      kind: 'providerDirectory' as const,
      providerId,
    })),
    paths,
  };
}

/** Claude Code owns two skills; Codex already has one of them. */
function snapshot(): InstalledScanSnapshot {
  return {
    ...MOCK_INSTALLED_SCAN,
    universal: { skillsDir: '/Users/mock/.agents/skills', skillsDirExists: true, skillCount: 0 },
    providers: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        universal: false,
        detected: true,
        skillsDir: CLAUDE_DIR,
        skillsDirExists: true,
        skillCount: 2,
      },
      {
        id: 'codex',
        name: 'Codex',
        universal: false,
        detected: true,
        skillsDir: CODEX_DIR,
        skillsDirExists: true,
        skillCount: 1,
      },
    ],
    skills: [
      skill(
        'code-review',
        ['claude-code', 'codex'],
        [{ path: `${CLAUDE_DIR}/code-review` }, { path: `${CODEX_DIR}/code-review` }],
      ),
      skill('tdd', ['claude-code'], [{ path: `${CLAUDE_DIR}/tdd` }]),
    ],
    warnings: [],
  };
}

function renderDialog(onOpenChange = vi.fn()) {
  render(
    <CopyProviderSkillsDialog
      sourceProviderId="claude-code"
      sourceProviderName="Claude Code"
      snapshot={snapshot()}
      open
      onOpenChange={onOpenChange}
    />,
  );
  return onOpenChange;
}

describe('CopyProviderSkillsDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    copyMock.copyProviderSkills.mockReset();
    copyMock.copyProviderSkills.mockResolvedValue({
      targets: [{ providerId: 'codex', copied: 1, skipped: 1, refused: 0, failed: 0, issues: [] }],
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

  it('lists each destination with its to-copy / already-there counts', () => {
    renderDialog();

    expect(screen.getByRole('checkbox', { name: /^codex$/i })).toBeInTheDocument();
    expect(screen.getByText('1 to copy, 1 already there')).toBeInTheDocument();
    // An undetected registry provider has nothing yet, so everything is to copy.
    expect(screen.getAllByText('2 to copy, 0 already there').length).toBeGreaterThan(0);
  });

  it('filters destinations by search while keeping hidden selections', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /^codex$/i }));
    await user.type(screen.getByRole('textbox', { name: /search providers/i }), 'zzz');

    expect(screen.queryByRole('checkbox', { name: /^codex$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no providers match/i)).toBeInTheDocument();
    // The hidden selection survives: the footer still counts it and Copy stays live.
    expect(screen.getByText(/copying to 1 provider/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /clear provider search/i }));
    expect(screen.getByRole('checkbox', { name: /^codex$/i })).toBeChecked();
  });

  it('names plugin-managed skills as skipped in a popover, and copies without them', async () => {
    const user = userEvent.setup();
    const withPlugin = snapshot();
    withPlugin.skills.push({
      ...skill('plugin-goodies', ['claude-code'], []),
      origins: [{ kind: 'claudePlugin', plugin: 'demo-plugin', marketplace: 'demo', version: '1' }],
    });
    render(
      <CopyProviderSkillsDialog
        sourceProviderId="claude-code"
        sourceProviderName="Claude Code"
        snapshot={withPlugin}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /1 plugin-managed skill/i }));
    expect(screen.getByText('plugin-goodies')).toBeInTheDocument();

    vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();
    await user.click(screen.getByRole('checkbox', { name: /^codex$/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));
    await waitFor(() => {
      expect(copyMock.copyProviderSkills).toHaveBeenCalledWith(
        'claude-code',
        ['code-review', 'tdd'],
        ['codex'],
        expect.any(Function),
      );
    });
  });

  it('never offers Universal as a destination', () => {
    renderDialog();
    expect(screen.queryByRole('checkbox', { name: /^universal$/i })).not.toBeInTheDocument();
  });

  it('keeps submit disabled until a destination is selected', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole('button', { name: /^copy$/i })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /^codex$/i }));
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeEnabled();
  });

  it('sends the source provider’s owned skill names to the selected targets', async () => {
    const user = userEvent.setup();
    vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /^codex$/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => {
      expect(copyMock.copyProviderSkills).toHaveBeenCalledWith(
        'claude-code',
        ['code-review', 'tdd'],
        ['codex'],
        expect.any(Function),
      );
    });
  });

  it('closes, summarises copied/skipped/failed, and rescans on completion', async () => {
    const user = userEvent.setup();
    const rescanSpy = vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();
    const onOpenChange = renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /^codex$/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => expect(rescanSpy).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock.success).toHaveBeenCalledWith('Copied 1, skipped 1, failed 0');
  });

  it('warns rather than celebrating when a skill failed', async () => {
    const user = userEvent.setup();
    vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();
    copyMock.copyProviderSkills.mockResolvedValue({
      targets: [
        {
          providerId: 'codex',
          copied: 1,
          skipped: 0,
          refused: 0,
          failed: 1,
          issues: [{ skillName: 'tdd', status: 'failed', message: 'boom' }],
        },
      ],
    });
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /^codex$/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => expect(toastMock.warning).toHaveBeenCalled());
    expect(toastMock.warning).toHaveBeenCalledWith(
      'Copied 1, skipped 0, failed 1',
      expect.objectContaining({ description: 'tdd' }),
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('reports determinate progress and the current skill while a run is in flight', async () => {
    const user = userEvent.setup();
    vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();
    const pending: { settle?: (value: unknown) => void } = {};
    copyMock.copyProviderSkills.mockReturnValue(
      new Promise((resolve) => {
        pending.settle = resolve;
      }),
    );
    const onOpenChange = renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /^codex$/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    // Nothing has ticked yet: a bar at zero, not an indeterminate spinner alone.
    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');

    const onProgress = copyMock.copyProviderSkills.mock.calls[0]?.[3] as (progress: {
      completed: number;
      total: number;
      skillName: string;
    }) => void;

    act(() => onProgress({ completed: 1, total: 2, skillName: 'code-review' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('1 of 2 · code-review')).toBeInTheDocument();

    act(() => onProgress({ completed: 2, total: 2, skillName: 'tdd' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('2 of 2 · tdd')).toBeInTheDocument();

    // 100% gives way to the summary, and the bar goes with the dialog.
    pending.settle?.({
      targets: [{ providerId: 'codex', copied: 2, skipped: 0, refused: 0, failed: 0, issues: [] }],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastMock.success).toHaveBeenCalledWith('Copied 2, skipped 0, failed 0');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('cannot be dismissed while a run is in flight', async () => {
    const user = userEvent.setup();
    vi.spyOn(useInstalledScanStore.getState(), 'rescan').mockResolvedValue();
    const pending: { settle?: (value: unknown) => void } = {};
    copyMock.copyProviderSkills.mockReturnValue(
      new Promise((resolve) => {
        pending.settle = resolve;
      }),
    );
    const onOpenChange = renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /^codex$/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await screen.findByRole('button', { name: /copying/i });
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();

    expect(pending.settle).toBeDefined();
    pending.settle?.({
      targets: [{ providerId: 'codex', copied: 2, skipped: 0, refused: 0, failed: 0, issues: [] }],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
