import { render, screen, waitFor, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GITHUB_REPO_URL } from '@/lib/desktop-download';
import { MOCK_EMPTY_SCAN, MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types';
import type { ScannedSkill } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model';
import { SkillsLibraryView } from './SkillsLibraryView';
import { SkillsSidebar } from './SkillsSidebar';

const scanMock = vi.hoisted(() => ({
  hasLocalLibrary: false as boolean,
  getInstalledScan: vi.fn(),
  scanInstalled: vi.fn(),
  revealProviderSkillsDir: vi.fn(),
  openExternal: vi.fn(),
  uninstall: vi.fn(),
  copySkillToProviders: vi.fn(),
  copyProviderSkills: vi.fn(),
}));

vi.mock('@platform', () => ({
  platform: {
    get hasLocalLibrary() {
      return scanMock.hasLocalLibrary;
    },
    copiesInstallCommand: true,
    getInstalledScan: (...args: unknown[]) => scanMock.getInstalledScan(...args),
    scanInstalled: (...args: unknown[]) => scanMock.scanInstalled(...args),
    revealProviderSkillsDir: (...args: unknown[]) => scanMock.revealProviderSkillsDir(...args),
    listInstalled: vi.fn(),
    listProviders: vi.fn(),
    install: vi.fn(),
    uninstall: (...args: unknown[]) => scanMock.uninstall(...args),
    copySkillToProviders: (...args: unknown[]) => scanMock.copySkillToProviders(...args),
    copyProviderSkills: (...args: unknown[]) => scanMock.copyProviderSkills(...args),
    openExternal: (...args: unknown[]) => scanMock.openExternal(...args),
  },
}));

describe('SkillsLibraryView (web)', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = false;
    scanMock.openExternal.mockResolvedValue(undefined);
  });

  it('shows get-the-app messaging and opens the download link', async () => {
    const user = userEvent.setup();
    render(<SkillsLibraryView />);

    expect(screen.getByRole('heading', { name: 'Installed' })).toBeInTheDocument();
    expect(screen.getByText(/local skill library lives on your device/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Get the desktop app' }));

    expect(scanMock.openExternal).toHaveBeenCalledWith(GITHUB_REPO_URL);
  });
});

describe('SkillsLibraryView (local / mock)', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = true;
    scanMock.scanInstalled.mockResolvedValue(MOCK_INSTALLED_SCAN);
    scanMock.getInstalledScan.mockResolvedValue(MOCK_INSTALLED_SCAN);
    scanMock.revealProviderSkillsDir.mockResolvedValue(true);
    scanMock.uninstall.mockResolvedValue({ results: [] });
    scanMock.copySkillToProviders.mockResolvedValue({
      results: [{ providerId: 'cursor', status: 'copied' }],
    });
    useInstalledScanStore.setState({
      snapshot: MOCK_INSTALLED_SCAN,
      error: null,
      refreshing: false,
    });
    useInstalledSkillsUiStore.setState({
      providerFilter: ALL_AGENTS_FILTER_ID,
      layoutMode: 'grid',
    });
  });

  it('lists installed skills with Universal and aggregated provider badges', () => {
    render(<SkillsLibraryView />);

    expect(screen.getByRole('heading', { name: 'Installed' })).toBeInTheDocument();
    expect(screen.getByText('find-skills')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Universal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();

    const findSkillsCard = screen.getByText('find-skills').closest('[data-slot="card"]');
    expect(findSkillsCard).toBeTruthy();
    expect(findSkillsCard?.textContent).not.toMatch(/\/Users\/mock/);
    expect(screen.queryByText(/Original at/i)).not.toBeInTheDocument();
  });

  it('mirrors the selected provider filter in the toolbar title and count', () => {
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    render(<SkillsLibraryView />);

    const toolbarHeading = screen.getByRole('heading', { name: 'Claude Code' });
    expect(toolbarHeading).toBeInTheDocument();
    expect(toolbarHeading.closest('div')).toHaveTextContent('2');
  });

  it('filters the skill list from the local search field', async () => {
    const user = userEvent.setup();
    render(<SkillsLibraryView />);

    expect(screen.getByText('find-skills')).toBeInTheDocument();
    expect(screen.getByText('code-review')).toBeInTheDocument();
    expect(screen.getByText('frontend-design')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search installed skills/i), 'code');

    expect(screen.getByText('code-review')).toBeInTheDocument();
    expect(screen.queryByText('find-skills')).not.toBeInTheDocument();
    expect(screen.queryByText('frontend-design')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(/search installed skills/i));
    await user.type(screen.getByLabelText(/search installed skills/i), 'anthropics');
    expect(screen.getByText('frontend-design')).toBeInTheDocument();
    expect(screen.queryByText('find-skills')).not.toBeInTheDocument();
    expect(screen.queryByText('code-review')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(/search installed skills/i));
    await user.type(screen.getByLabelText(/search installed skills/i), 'zzzz-no-match');
    expect(screen.getByText(/no skills match/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear skill search/i }));
    expect(screen.getByText('find-skills')).toBeInTheDocument();
    expect(screen.getByText('code-review')).toBeInTheDocument();
    expect(screen.getByText('frontend-design')).toBeInTheDocument();
  });

  it('switches installed skills from grid cards to compact list rows', async () => {
    const user = userEvent.setup();
    render(<SkillsLibraryView />);

    const grid = screen.getByTestId('skill-card-container');
    expect(grid).toHaveAttribute('data-layout', 'grid');
    expect(screen.getByText('find-skills').closest('[data-slot="card"]')).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: 'List' }));

    expect(useInstalledSkillsUiStore.getState().layoutMode).toBe('list');
    const list = screen.getByTestId('skill-card-container');
    expect(list).toHaveAttribute('data-layout', 'list');
    const listRow = screen.getByText('find-skills').closest('[data-slot="skill-list-row"]');
    expect(listRow).toBeTruthy();
    expect(listRow?.textContent).not.toMatch(/\/Users\/mock/);
    expect(listRow?.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(screen.queryByText(/Original at/i)).not.toBeInTheDocument();
  });

  it('restores list layout from the session UI store', () => {
    useInstalledSkillsUiStore.setState({ layoutMode: 'list' });
    render(<SkillsLibraryView />);

    expect(screen.getByTestId('skill-card-container')).toHaveAttribute('data-layout', 'list');
    expect(screen.getByText('find-skills').closest('[data-slot="skill-list-row"]')).toBeTruthy();
  });

  it('filters to a provider’s direct skills and reveals the path', async () => {
    const user = userEvent.setup();
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    render(<SkillsLibraryView />);

    expect(screen.getByText('code-review')).toBeInTheDocument();
    expect(screen.getByText('find-skills')).toBeInTheDocument();
    expect(screen.queryByText('frontend-design')).not.toBeInTheDocument();

    await user.click(screen.getByTitle(/reveal in finder/i));
    expect(scanMock.revealProviderSkillsDir).toHaveBeenCalledWith('claude-code');
  });

  it('disables reveal when the selected provider directory is missing', async () => {
    const user = userEvent.setup();
    useInstalledScanStore.setState({ snapshot: MOCK_EMPTY_SCAN });
    useInstalledSkillsUiStore.setState({
      providerFilter: UNIVERSAL_PROVIDER_ID,
    });
    render(<SkillsLibraryView />);

    expect(screen.getByTitle(/directory is missing/i)).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /open folder/i }));
    expect(scanMock.revealProviderSkillsDir).toHaveBeenCalledWith('universal');
  });

  it('manual Rescan replaces the shared snapshot while keeping prior cards', async () => {
    const user = userEvent.setup();
    let resolveScan: (value: typeof MOCK_EMPTY_SCAN) => void = () => undefined;
    scanMock.scanInstalled.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );
    render(<SkillsLibraryView />);

    await user.click(screen.getByRole('button', { name: /rescan/i }));
    expect(screen.getByText('find-skills')).toBeInTheDocument();
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument();

    resolveScan(MOCK_EMPTY_SCAN);
    await waitFor(() => {
      expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_EMPTY_SCAN);
    });
  });

  it('keeps prior results visible while refreshing', () => {
    useInstalledScanStore.setState({ refreshing: true });
    render(<SkillsLibraryView />);

    expect(screen.getByText('find-skills')).toBeInTheDocument();
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument();
  });

  it('opens overflow, confirms uninstall, calls platform, and rescans', async () => {
    const user = userEvent.setup();
    const rescanSpy = vi.spyOn(useInstalledScanStore.getState(), 'rescan');
    render(<SkillsLibraryView />);

    const findSkillsCard = screen
      .getByText('find-skills')
      .closest('[data-slot="card"]') as HTMLElement;
    expect(findSkillsCard).toBeTruthy();

    await user.click(within(findSkillsCard).getByRole('button', { name: /^Installed$/ }));
    await user.click(screen.getByRole('menuitem', { name: /uninstall/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /yes, uninstall/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /yes, uninstall/i }));

    await waitFor(() => {
      expect(scanMock.uninstall).toHaveBeenCalledWith('find-skills', {
        agentScope: 'all',
        providerIds: [UNIVERSAL_PROVIDER_ID, 'claude-code'],
      });
    });
    expect(rescanSpy).toHaveBeenCalled();
    rescanSpy.mockRestore();
  }, 10_000);

  it('opens copy dialog from card overflow and copies to selected providers', async () => {
    const user = userEvent.setup();
    const rescanSpy = vi.spyOn(useInstalledScanStore.getState(), 'rescan');
    render(<SkillsLibraryView />);

    const findSkillsCard = screen
      .getByText('find-skills')
      .closest('[data-slot="card"]') as HTMLElement;

    await user.click(within(findSkillsCard).getByRole('button', { name: /^Installed$/ }));
    await user.click(screen.getByRole('menuitem', { name: /copy to other providers/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/already installed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^other providers$/i }));
    await user.click(screen.getByRole('checkbox', { name: /cursor/i }));
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => {
      expect(scanMock.copySkillToProviders).toHaveBeenCalledWith('find-skills', ['cursor']);
    });
    expect(rescanSpy).toHaveBeenCalled();
    rescanSpy.mockRestore();
  }, 10_000);

  it('opens the same copy dialog from list-row overflow', async () => {
    const user = userEvent.setup();
    useInstalledSkillsUiStore.setState({ layoutMode: 'list' });
    render(<SkillsLibraryView />);

    const listRow = screen.getByText('find-skills').closest('[data-slot="skill-list-row"]');
    expect(listRow).toBeTruthy();

    await user.click(within(listRow as HTMLElement).getByRole('button', { name: /^Installed$/ }));
    await user.click(screen.getByRole('menuitem', { name: /copy to other providers/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /copy find-skills/i })).toBeInTheDocument();
  }, 10_000);

  it('hides copy action when the platform has no local library', () => {
    scanMock.hasLocalLibrary = false;
    render(<SkillsLibraryView />);

    expect(screen.queryByRole('button', { name: /^Installed$/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /copy to other providers/i }),
    ).not.toBeInTheDocument();
  });

  it('scopes uninstall to the selected provider', async () => {
    const user = userEvent.setup();
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    render(<SkillsLibraryView />);

    const codeReviewCard = screen
      .getByText('code-review')
      .closest('[data-slot="card"]') as HTMLElement;
    await user.click(within(codeReviewCard).getByRole('button', { name: /^Installed$/ }));
    await user.click(screen.getByRole('menuitem', { name: /uninstall/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /yes, uninstall/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /yes, uninstall/i }));

    await waitFor(() => {
      expect(scanMock.uninstall).toHaveBeenCalledWith('code-review', {
        agentScope: { providerId: 'claude-code' },
        providerIds: ['claude-code'],
      });
    });
  }, 10_000);

  it('uninstalls by slug when the display name differs', async () => {
    const user = userEvent.setup();
    useInstalledScanStore.setState({
      snapshot: {
        ...MOCK_INSTALLED_SCAN,
        skills: [
          {
            ...MOCK_INSTALLED_SCAN.skills[0],
            name: 'Find Skills',
            uninstallName: 'find-skills',
          } as ScannedSkill,
        ],
      },
    });
    render(<SkillsLibraryView />);

    const skillCard = screen.getByText('Find Skills').closest('[data-slot="card"]') as HTMLElement;
    await user.click(within(skillCard).getByRole('button', { name: /^Installed$/ }));
    await user.click(screen.getByRole('menuitem', { name: /uninstall/i }));
    await user.click(screen.getByRole('button', { name: /yes, uninstall/i }));

    await waitFor(() => {
      expect(scanMock.uninstall).toHaveBeenCalledWith('find-skills', {
        agentScope: 'all',
        providerIds: [UNIVERSAL_PROVIDER_ID, 'claude-code'],
      });
    });
  });
});

describe('SkillsSidebar providers', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = true;
    useInstalledScanStore.setState({
      snapshot: MOCK_INSTALLED_SCAN,
      error: null,
      refreshing: false,
    });
    useInstalledSkillsUiStore.setState({
      providerFilter: ALL_AGENTS_FILTER_ID,
      layoutMode: 'grid',
    });
  });

  it('does not show provider selection styling when Explore is active', () => {
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    render(<SkillsSidebar active="explore" onSelect={vi.fn()} />);

    const claude = screen.getByText('Claude Code').closest('button');
    expect(claude).not.toHaveClass('font-medium');
    expect(claude).not.toHaveClass('shadow-xs');
  });

  it('shows provider selection styling when Installed is active', () => {
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    render(<SkillsSidebar active="installed" onSelect={vi.fn()} />);

    const claude = screen.getByText('Claude Code').closest('button');
    expect(claude).toHaveClass('font-medium');
  });

  it('shows Universal, filled providers, and collapsible other providers', () => {
    const onSelect = vi.fn();
    render(<SkillsSidebar active="installed" onSelect={onSelect} />);

    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.getByLabelText(/search providers/i)).toBeInTheDocument();
    expect(screen.queryByText('All Agents')).not.toBeInTheDocument();
    expect(screen.getByText('Universal')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    // Universal-registry agents with a distinct dir list as active when Universal has skills.
    expect(screen.getByText('Cursor')).toBeInTheDocument();

    const universal = screen.getByText('Universal').closest('button');
    expect(universal).toHaveTextContent('2');
    const cursorRow = screen.getByText('Cursor').closest('button');
    expect(cursorRow).toHaveTextContent('2');
  });

  it('renders the provider brand icon inside its row', () => {
    render(<SkillsSidebar active="installed" onSelect={vi.fn()} />);

    const claude = screen.getByText('Claude Code').closest('button') as HTMLElement;
    expect(within(claude).getByTitle('Claude Code')).toBeInTheDocument();
  });

  it('filters active and inactive providers from the top search field', async () => {
    const user = userEvent.setup();
    render(<SkillsSidebar active="installed" onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText(/search providers/i), 'claude');

    expect(screen.queryByText('Universal')).not.toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.queryByText('Cursor')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear provider search/i }));

    expect(screen.getByText('Universal')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });

  it('clears the provider filter when Installed nav is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    render(<SkillsSidebar active="explore" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Installed' }));

    expect(onSelect).toHaveBeenCalledWith('installed');
    expect(useInstalledSkillsUiStore.getState().providerFilter).toBe(ALL_AGENTS_FILTER_ID);
  });

  it('selects a provider from the in-memory snapshot without scanning', async () => {
    const user = userEvent.setup();
    scanMock.scanInstalled.mockClear();
    scanMock.getInstalledScan.mockClear();
    render(<SkillsSidebar active="installed" onSelect={vi.fn()} />);

    await user.click(screen.getByText('Claude Code'));
    expect(useInstalledSkillsUiStore.getState().providerFilter).toBe('claude-code');
    expect(scanMock.scanInstalled).not.toHaveBeenCalled();
    expect(scanMock.getInstalledScan).not.toHaveBeenCalled();
  });

  it('hides the Projects filter in the web app', () => {
    scanMock.hasLocalLibrary = false;
    render(<SkillsSidebar active="projects" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Search projects')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose coding folder' })).not.toBeInTheDocument();
  });
});

describe('Installed Skills shared snapshot lifecycle', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = true;
    scanMock.scanInstalled.mockReset();
    scanMock.getInstalledScan.mockReset();
    scanMock.scanInstalled.mockResolvedValue(MOCK_INSTALLED_SCAN);
    scanMock.getInstalledScan.mockResolvedValue(MOCK_INSTALLED_SCAN);
    useInstalledScanStore.setState({
      snapshot: null,
      error: null,
      refreshing: false,
    });
  });

  it('rescans when the Installed Skills tab becomes active (app-open default)', async () => {
    const { SkillsContent } = await import('./SkillsContent');
    render(<SkillsContent active="installed" />);

    await waitFor(() => {
      expect(scanMock.scanInstalled).toHaveBeenCalled();
    });
    expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_INSTALLED_SCAN);
  });

  it('keeps prior results visible while Installed Skills activation rescans', async () => {
    useInstalledScanStore.setState({ snapshot: MOCK_INSTALLED_SCAN });
    let resolveScan: (value: typeof MOCK_EMPTY_SCAN) => void = () => undefined;
    scanMock.scanInstalled.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );

    const { SkillsContent } = await import('./SkillsContent');
    render(<SkillsContent active="installed" />);

    expect(screen.getByText('find-skills')).toBeInTheDocument();
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument();
    expect(scanMock.scanInstalled).toHaveBeenCalled();

    resolveScan(MOCK_EMPTY_SCAN);
    await waitFor(() => {
      expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_EMPTY_SCAN);
    });
  });

  it('hydrates the cached platform snapshot when Installed Skills is not active', async () => {
    scanMock.getInstalledScan.mockResolvedValue(MOCK_INSTALLED_SCAN);
    const { SkillsContent } = await import('./SkillsContent');
    render(<SkillsContent active="explore" />);

    await waitFor(() => {
      expect(scanMock.getInstalledScan).toHaveBeenCalled();
    });
    expect(scanMock.scanInstalled).not.toHaveBeenCalled();
    expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_INSTALLED_SCAN);
  });
});

describe('SkillsLibraryView bulk copy entry point', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = true;
    scanMock.scanInstalled.mockResolvedValue(MOCK_INSTALLED_SCAN);
    scanMock.getInstalledScan.mockResolvedValue(MOCK_INSTALLED_SCAN);
    scanMock.copyProviderSkills.mockResolvedValue({ targets: [] });
    useInstalledScanStore.setState({
      snapshot: MOCK_INSTALLED_SCAN,
      error: null,
      refreshing: false,
    });
    useInstalledSkillsUiStore.setState({
      providerFilter: ALL_AGENTS_FILTER_ID,
      layoutMode: 'grid',
    });
  });

  const copyToButton = () => screen.queryByRole('button', { name: /copy to/i });

  it('hides the button for the All agents selection', () => {
    render(<SkillsLibraryView />);
    expect(copyToButton()).not.toBeInTheDocument();
  });

  it('hides the button for the Universal selection', () => {
    useInstalledSkillsUiStore.setState({ providerFilter: UNIVERSAL_PROVIDER_ID });
    render(<SkillsLibraryView />);
    expect(copyToButton()).not.toBeInTheDocument();
  });

  it('shows the button for a universal-registry provider with only Universal skills', () => {
    // Cursor's own directory holds no real folders, but as a universal-registry
    // agent it can invoke the Universal skills — and those are copyable now.
    useInstalledSkillsUiStore.setState({ providerFilter: 'cursor' });
    render(<SkillsLibraryView />);
    expect(copyToButton()).toBeInTheDocument();
  });

  it('hides the button for a provider with nothing invokable', () => {
    useInstalledScanStore.setState({
      snapshot: {
        ...MOCK_INSTALLED_SCAN,
        providers: MOCK_INSTALLED_SCAN.providers.map((provider) =>
          provider.id === 'cursor' ? { ...provider, universal: false } : provider,
        ),
      },
    });
    useInstalledSkillsUiStore.setState({ providerFilter: 'cursor' });
    render(<SkillsLibraryView />);
    expect(copyToButton()).not.toBeInTheDocument();
  });

  it('shows the button for a concrete provider that owns skills', () => {
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    render(<SkillsLibraryView />);
    expect(copyToButton()).toBeInTheDocument();
    expect(copyToButton()).toBeEnabled();
  });

  it('disables the button while a rescan is in flight', () => {
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    useInstalledScanStore.setState({ refreshing: true });
    render(<SkillsLibraryView />);
    expect(copyToButton()).toBeDisabled();
  });

  it('opens the bulk copy dialog listing the counts for each destination', async () => {
    const user = userEvent.setup();
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' });
    render(<SkillsLibraryView />);

    const button = copyToButton();
    expect(button).not.toBeNull();
    if (!button) return;
    await user.click(button);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/copy every claude code skill/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /^cursor$/i })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('checkbox', { name: /^universal$/i }),
    ).not.toBeInTheDocument();
  });
});
