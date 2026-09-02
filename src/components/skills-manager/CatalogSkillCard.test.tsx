import { MOCK_AUDITS, MOCK_DETAIL, MOCK_LEADERBOARD } from '@/catalog/fixtures';
import type { SkillsShSkill } from '@/catalog/types';
import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import { render, screen, waitFor, within } from '@/test/test-utils';
import { catalog } from '@catalog';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import {
  findScannedSkillForCatalog,
  installedSkillKeysFromSkills,
  installedSkillKeysFromSnapshot,
  scannedSkillsByKey,
} from './catalog-installed-match';
import { CatalogSkillCard } from './CatalogSkillCard';

vi.mock('@catalog', () => ({
  catalog: {
    fetchLeaderboard: vi.fn(),
    search: vi.fn(),
    fetchDetail: vi.fn(),
    fetchAudits: vi.fn(),
  },
}));

const platformMock = vi.hoisted(() => ({
  hasLocalLibrary: true,
  copiesInstallCommand: false,
  install: vi.fn(),
  uninstall: vi.fn(),
  scanInstalled: vi.fn(),
  copySkillToProviders: vi.fn(),
  openExternal: vi.fn(),
}));

vi.mock('@platform', () => ({
  platform: {
    get hasLocalLibrary() {
      return platformMock.hasLocalLibrary;
    },
    get copiesInstallCommand() {
      return platformMock.copiesInstallCommand;
    },
    install: (...args: unknown[]) => platformMock.install(...args),
    uninstall: (...args: unknown[]) => platformMock.uninstall(...args),
    scanInstalled: (...args: unknown[]) => platformMock.scanInstalled(...args),
    copySkillToProviders: (...args: unknown[]) => platformMock.copySkillToProviders(...args),
    openExternal: (...args: unknown[]) => platformMock.openExternal(...args),
  },
}));

// A modal Radix menu marks the rest of the body aria-hidden, which hides the
// dialog from *ByRole queries — query the element itself instead.
const dialogEl = () => document.querySelector('[role="dialog"]');

const EMPTY_SCAN = { ...MOCK_INSTALLED_SCAN, skills: [] };

/** Feeds a catalog card from the scan store, the way SkillsDashboardView does. */
function ScanBackedCard({ skill }: { skill: SkillsShSkill }) {
  const snapshot = useInstalledScanStore((state) => state.snapshot);
  return (
    <CatalogSkillCard
      skill={skill}
      installedKeys={installedSkillKeysFromSnapshot(snapshot)}
      snapshot={snapshot}
      scannedSkill={findScannedSkillForCatalog(skill, scannedSkillsByKey(snapshot?.skills ?? []))}
    />
  );
}

describe('CatalogSkillCard categories', () => {
  it('shows a pill per category, primary first', () => {
    const skill = MOCK_LEADERBOARD[0];
    if (!skill) throw new Error('expected MOCK_LEADERBOARD[0]');

    render(
      <CatalogSkillCard
        skill={{ ...skill, categories: ['git-github', 'cli-utilities'] }}
        installedKeys={new Set()}
        snapshot={null}
        scannedSkill={undefined}
      />,
    );

    expect(
      [...document.querySelectorAll('[data-category]')].map((pill) =>
        pill.getAttribute('data-category'),
      ),
    ).toEqual(['git-github', 'cli-utilities']);
    expect(screen.getByText('Git & GitHub')).toBeInTheDocument();
  });
});

describe('CatalogSkillCard detail dialog', () => {
  beforeEach(() => {
    vi.mocked(catalog.fetchDetail).mockResolvedValue(MOCK_DETAIL);
    vi.mocked(catalog.fetchAudits).mockResolvedValue(MOCK_AUDITS);
    platformMock.install.mockReset().mockResolvedValue({ results: [] });
    platformMock.uninstall.mockReset().mockResolvedValue({ results: [] });
    platformMock.scanInstalled.mockReset().mockResolvedValue(EMPTY_SCAN);
    useInstalledScanStore.setState({
      snapshot: EMPTY_SCAN,
      error: null,
      refreshing: false,
      projectInstalls: {},
    });
  });

  async function openDetail() {
    const user = userEvent.setup();
    const skill = MOCK_LEADERBOARD[0];
    if (!skill) throw new Error('expected MOCK_LEADERBOARD[0]');

    render(
      <CatalogSkillCard
        skill={skill}
        installedKeys={new Set()}
        snapshot={null}
        scannedSkill={undefined}
      />,
    );

    await user.click(screen.getByText(skill.name));
    await waitFor(() => expect(dialogEl()).not.toBeNull());
    return { user, skill };
  }

  it('installs from the dialog without dismissing it', async () => {
    let settleInstall!: (value: { results: never[] }) => void;
    platformMock.install.mockReturnValue(
      new Promise((resolve) => {
        settleInstall = resolve;
      }),
    );

    const { user } = await openDetail();
    const dialog = dialogEl();
    if (!dialog) throw new Error('expected the detail dialog');

    await user.click(
      await within(dialog as HTMLElement).findByRole('button', { name: /^install$/i }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /global/i }));

    // The install menu is portaled outside the dialog content; choosing an item
    // must not read as an outside click and tear the dialog down mid-install.
    await waitFor(() => expect(platformMock.install).toHaveBeenCalled());
    expect(dialogEl()).not.toBeNull();
    expect(within(dialogEl() as HTMLElement).getByText(/installing/i)).toBeInTheDocument();

    settleInstall({ results: [] });
    await waitFor(() =>
      expect(within(dialogEl() as HTMLElement).queryByText(/installing/i)).not.toBeInTheDocument(),
    );
    // Closing the modal dialog restores the body's interactivity.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(dialogEl()).toBeNull());
    expect(document.body.style.pointerEvents).not.toBe('none');
  });

  it('dismisses the dialog when uninstalling from it', async () => {
    const user = userEvent.setup();
    const skill = MOCK_LEADERBOARD[0];
    const scanned = MOCK_INSTALLED_SCAN.skills[0];
    if (!skill || !scanned) throw new Error('expected fixtures');

    render(
      <CatalogSkillCard
        skill={{ ...skill, name: scanned.name }}
        installedKeys={installedSkillKeysFromSkills([scanned])}
        snapshot={MOCK_INSTALLED_SCAN}
        scannedSkill={scanned}
      />,
    );

    const cardTitle = screen.getAllByText(scanned.name)[0];
    if (!cardTitle) throw new Error('expected the card title');
    await user.click(cardTitle);
    await waitFor(() => expect(dialogEl()).not.toBeNull());

    const dialog = dialogEl();
    if (!dialog) throw new Error('expected the detail dialog');
    await user.click(within(dialog as HTMLElement).getByRole('button', { name: /^installed$/i }));
    await user.click(await screen.findByRole('menuitem', { name: /^uninstall$/i }));
    await user.click(screen.getByRole('button', { name: /yes, uninstall/i }));

    await waitFor(() => expect(platformMock.uninstall).toHaveBeenCalled());

    // Uninstalling from the dialog closes it before the rescan reshapes the card
    // behind it, so no backdrop or scroll lock is left stranded over the app.
    await waitFor(() => expect(dialogEl()).toBeNull());
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('flips the pill to Installed and then closes the dialog', async () => {
    const skill = MOCK_LEADERBOARD[0];
    if (!skill) throw new Error('expected MOCK_LEADERBOARD[0]');
    platformMock.install.mockResolvedValue({
      results: [{ providerId: 'claude-code', status: 'written' }],
    });
    platformMock.scanInstalled.mockResolvedValue(MOCK_INSTALLED_SCAN);

    const user = userEvent.setup();
    render(<ScanBackedCard skill={skill} />);

    await user.click(screen.getByText(skill.name));
    await waitFor(() => expect(dialogEl()).not.toBeNull());

    await user.click(
      await within(dialogEl() as HTMLElement).findByRole('button', { name: /^install$/i }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /global/i }));

    // The rescan is what the pill reads, so it has to land before the close.
    await waitFor(() => expect(platformMock.scanInstalled).toHaveBeenCalled());
    await waitFor(() => expect(dialogEl()).toBeNull());
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(screen.getByRole('button', { name: /^installed$/i })).toBeInTheDocument();
  });

  it('marks a project-scope install "In project" without a home-root rescan', async () => {
    const skill = MOCK_LEADERBOARD[0];
    if (!skill) throw new Error('expected MOCK_LEADERBOARD[0]');
    platformMock.install.mockResolvedValue({
      results: [{ providerId: 'universal', status: 'written' }],
      projectPath: '/Users/mock/code/demo',
    });

    const user = userEvent.setup();
    render(<ScanBackedCard skill={skill} />);

    await user.click(screen.getByText(skill.name));
    await waitFor(() => expect(dialogEl()).not.toBeNull());

    await user.click(
      await within(dialogEl() as HTMLElement).findByRole('button', { name: /^install$/i }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /project/i }));

    await waitFor(() => expect(dialogEl()).toBeNull());
    expect(screen.getByRole('button', { name: /^in project$/i })).toBeInTheDocument();
    // The global scan cannot see <project>/.agents/skills, so asking it is waste.
    expect(platformMock.scanInstalled).not.toHaveBeenCalled();
  });
});
