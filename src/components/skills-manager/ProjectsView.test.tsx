import { render, screen } from '@/test/test-utils';
import { MOCK_EMPTY_SCAN } from '@/platform/fixtures';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { useProjectsStore } from '@/store/projects-store';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GITHUB_REPO_URL } from '@/lib/desktop-download';
import { ProjectsView } from './ProjectsView';

const platformMock = vi.hoisted(() => ({
  hasLocalLibrary: false,
  openExternal: vi.fn(),
  pickCodingFolder: vi.fn(),
  listProjects: vi.fn(),
  scanProject: vi.fn(),
}));

vi.mock('@platform', () => ({ platform: platformMock }));

function projectSkill(name: string) {
  return {
    name,
    uninstallName: name,
    description: `${name} description`,
    scope: 'project' as const,
    providerIds: ['claude-code'],
    origins: [{ providerDirectory: { providerId: 'claude-code' } }],
    paths: [{ path: `/Users/partner/code/skilltopia/.claude/skills/${name}` }],
  };
}

function getChooseFolderButton() {
  const button = screen.getAllByRole('button', { name: 'Choose coding folder' }).at(0);
  if (!button) throw new Error('Choose coding folder button is missing');
  return button;
}

describe('ProjectsView (web)', () => {
  beforeEach(() => {
    platformMock.hasLocalLibrary = false;
    platformMock.openExternal.mockResolvedValue(undefined);
  });

  it('shows the desktop-app stub and opens the download link', async () => {
    const user = userEvent.setup();
    render(<ProjectsView />);

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText(/specific projects can only be fetched/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Get the desktop app' }));

    expect(platformMock.openExternal).toHaveBeenCalledWith(GITHUB_REPO_URL);
  });
});

describe('ProjectsView (desktop)', () => {
  beforeEach(() => {
    localStorage.clear();
    platformMock.hasLocalLibrary = true;
    platformMock.pickCodingFolder.mockReset();
    platformMock.listProjects.mockReset();
    platformMock.scanProject.mockReset();
    useProjectsStore.setState({
      root: null,
      projects: [],
      selectedPath: null,
      snapshot: null,
      refreshing: false,
      error: null,
      hasLoadedProjects: false,
    });
    useInstalledScanStore.setState({ snapshot: null });
    useInstalledSkillsUiStore.setState({ projectSkillScope: 'all' });
  });

  it('shows an error when the native folder picker fails', async () => {
    platformMock.pickCodingFolder.mockRejectedValue(new Error('native folder picker failed'));
    const user = userEvent.setup();

    render(<ProjectsView />);
    await user.click(getChooseFolderButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't open or read this folder");
    expect(alert).not.toHaveTextContent('native folder picker failed');
  });

  it('shows an error when project discovery fails', async () => {
    platformMock.pickCodingFolder.mockResolvedValue('/Users/partner/code');
    platformMock.listProjects.mockRejectedValue(new Error('coding folder is unreadable'));
    const user = userEvent.setup();

    render(<ProjectsView />);
    await user.click(getChooseFolderButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't open or read this folder");
    expect(alert).not.toHaveTextContent('coding folder is unreadable');
  });

  it('shows a user-facing error when the default project scan fails', async () => {
    platformMock.pickCodingFolder.mockResolvedValue('/Users/partner/code');
    platformMock.listProjects.mockResolvedValue([
      { name: 'skilltopia', path: '/Users/partner/code/skilltopia', depth: 1, skillCount: 1 },
    ]);
    platformMock.scanProject.mockRejectedValue(new Error('permission denied at /private/path'));
    const user = userEvent.setup();

    render(<ProjectsView />);
    await user.click(getChooseFolderButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't open or read this folder");
    expect(alert).not.toHaveTextContent('/private/path');
  });

  it('shows an empty result after selecting a folder without projects', async () => {
    platformMock.pickCodingFolder.mockResolvedValue('/Users/partner/empty-code');
    platformMock.listProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<ProjectsView />);
    await user.click(getChooseFolderButton());

    expect(await screen.findByText('No project folders found')).toBeInTheDocument();
    expect(screen.queryByText('Find your projects')).not.toBeInTheDocument();
  });

  it('does not report an empty result before a saved root has loaded', () => {
    useProjectsStore.setState({ root: '/Users/partner/code' });

    render(<ProjectsView />);

    expect(screen.getByText('Find your projects')).toBeInTheDocument();
    expect(screen.queryByText('No project folders found')).not.toBeInTheDocument();
  });

  it('loads the default discovered project', async () => {
    platformMock.pickCodingFolder.mockResolvedValue('/Users/partner/code');
    platformMock.listProjects.mockResolvedValue([
      { name: 'skilltopia', path: '/Users/partner/code/skilltopia', depth: 1, skillCount: 0 },
    ]);
    platformMock.scanProject.mockResolvedValue(MOCK_EMPTY_SCAN);
    const user = userEvent.setup();

    render(<ProjectsView />);
    await user.click(getChooseFolderButton());

    expect(await screen.findByText(/No skills reach this project yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Project-only' }));

    expect(await screen.findByText(/No skills found in skilltopia/)).toBeInTheDocument();
  });

  it('lists globally installed skills alongside the project ones', async () => {
    platformMock.pickCodingFolder.mockResolvedValue('/Users/partner/code');
    platformMock.listProjects.mockResolvedValue([
      { name: 'skilltopia', path: '/Users/partner/code/skilltopia', depth: 1, skillCount: 1 },
    ]);
    platformMock.scanProject.mockResolvedValue({
      ...MOCK_EMPTY_SCAN,
      skills: [projectSkill('project-only-skill')],
    });
    useInstalledScanStore.setState({
      snapshot: { ...MOCK_EMPTY_SCAN, skills: [projectSkill('universal-skill')] },
    });
    const user = userEvent.setup();

    render(<ProjectsView />);
    await user.click(getChooseFolderButton());

    expect(await screen.findByText('project-only-skill')).toBeInTheDocument();
    expect(screen.getByText('universal-skill')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Project-only' }));

    expect(await screen.findByText('project-only-skill')).toBeInTheDocument();
    expect(screen.queryByText('universal-skill')).not.toBeInTheDocument();
  });

  it('does not keep projects from the previously selected root', async () => {
    useProjectsStore.setState({
      root: '/Users/partner/old-code',
      projects: [
        {
          name: 'old-project',
          path: '/Users/partner/old-code/old-project',
          depth: 1,
          skillCount: 0,
        },
      ],
      selectedPath: '/Users/partner/old-code/old-project',
      snapshot: MOCK_EMPTY_SCAN,
    });
    platformMock.pickCodingFolder.mockResolvedValue('/Users/partner/new-code');
    platformMock.listProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<ProjectsView />);
    await user.click(getChooseFolderButton());

    expect(await screen.findByText('No project folders found')).toBeInTheDocument();
    expect(screen.queryByText('/Users/partner/old-code/old-project')).not.toBeInTheDocument();
  });
});
