import { MOCK_AUDITS, MOCK_DETAIL, MOCK_LEADERBOARD } from '@/catalog/fixtures';
import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import type { InstalledScanSnapshot } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { render, screen, waitFor, within } from '@/test/test-utils';
import { catalog } from '@catalog';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model';
import { SkillCard } from './SkillCard';
import { SkillListRow } from './SkillListRow';

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
  revealPath: vi.fn(),
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
    revealPath: (...args: unknown[]) => platformMock.revealPath(...args),
  },
}));

// A modal Radix menu marks the rest of the body aria-hidden, which hides the
// dialog from *ByRole queries — query the element itself instead.
const dialogEl = () => document.querySelector('[role="dialog"]');

const scannedSkill = MOCK_INSTALLED_SCAN.skills.find((entry) => entry.name === 'find-skills');
const catalogSkill = MOCK_LEADERBOARD[0];

describe('installed skill detail dialog', () => {
  beforeEach(() => {
    vi.mocked(catalog.fetchDetail).mockResolvedValue(MOCK_DETAIL);
    vi.mocked(catalog.fetchAudits).mockResolvedValue(MOCK_AUDITS);
    platformMock.revealPath.mockReset().mockResolvedValue(true);
    platformMock.uninstall.mockReset().mockResolvedValue({ results: [] });
    platformMock.scanInstalled.mockReset().mockResolvedValue(MOCK_INSTALLED_SCAN);
    useInstalledScanStore.setState({ uninstalling: new Set<string>() });
  });

  it('opens a local detail dialog for a skill the catalog does not know', async () => {
    const user = userEvent.setup();
    if (!scannedSkill) throw new Error('expected the find-skills fixture');

    render(
      <SkillCard
        skill={scannedSkill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
      />,
    );

    await user.click(screen.getAllByText(scannedSkill.name)[0] as HTMLElement);
    await waitFor(() => expect(dialogEl()).not.toBeNull());

    const dialog = dialogEl() as HTMLElement;
    expect(within(dialog).getByText('Locations')).toBeInTheDocument();
    expect(within(dialog).getByText(scannedSkill.description)).toBeInTheDocument();
    expect(catalog.fetchDetail).not.toHaveBeenCalled();

    const [path] = scannedSkill.paths;
    if (!path) throw new Error('expected a scanned path');
    await user.click(
      within(dialog).getAllByRole('button', { name: /reveal in/i })[0] as HTMLElement,
    );
    expect(platformMock.revealPath).toHaveBeenCalledWith(path.originalPath ?? path.path);
  });

  it('opens the catalog detail for a matched skill, with installed actions', async () => {
    const user = userEvent.setup();
    if (!scannedSkill || !catalogSkill) throw new Error('expected fixtures');

    render(
      <SkillCard
        skill={scannedSkill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
        catalogSkill={{ ...catalogSkill, name: scannedSkill.name, slug: scannedSkill.name }}
      />,
    );

    await user.click(screen.getAllByText(scannedSkill.name)[0] as HTMLElement);
    await waitFor(() => expect(dialogEl()).not.toBeNull());

    await waitFor(() => expect(catalog.fetchDetail).toHaveBeenCalled());
    const dialog = dialogEl() as HTMLElement;
    expect(within(dialog).getByText('Installs')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^installed$/i })).toBeInTheDocument();
  });

  it('opens the dialog from a list row too', async () => {
    const user = userEvent.setup();
    if (!scannedSkill) throw new Error('expected the find-skills fixture');

    render(
      <SkillListRow
        skill={scannedSkill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
      />,
    );

    await user.click(screen.getAllByText(scannedSkill.name)[0] as HTMLElement);
    await waitFor(() => expect(dialogEl()).not.toBeNull());
  });

  it('closes the dialog and clears the overlay after uninstalling from it', async () => {
    const user = userEvent.setup();
    if (!scannedSkill) throw new Error('expected the find-skills fixture');

    render(
      <SkillCard
        skill={scannedSkill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
      />,
    );

    await user.click(screen.getAllByText(scannedSkill.name)[0] as HTMLElement);
    await waitFor(() => expect(dialogEl()).not.toBeNull());

    const dialog = dialogEl() as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: /^installed$/i }));
    await user.click(await screen.findByRole('menuitem', { name: /uninstall/i }));
    await user.click(await screen.findByRole('button', { name: /^yes/i }));

    await waitFor(() => expect(platformMock.uninstall).toHaveBeenCalled());
    await waitFor(() => expect(dialogEl()).toBeNull());
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('leaves the card in the pending state while the rescan runs', async () => {
    const user = userEvent.setup();
    if (!scannedSkill) throw new Error('expected the find-skills fixture');

    let finishScan: (snapshot: InstalledScanSnapshot) => void = () => undefined;
    platformMock.scanInstalled.mockReturnValue(
      new Promise<InstalledScanSnapshot>((resolve) => {
        finishScan = resolve;
      }),
    );

    render(
      <SkillCard
        skill={scannedSkill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
      />,
    );

    await user.click(screen.getAllByText(scannedSkill.name)[0] as HTMLElement);
    await waitFor(() => expect(dialogEl()).not.toBeNull());

    const dialog = dialogEl() as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: /^installed$/i }));
    await user.click(await screen.findByRole('menuitem', { name: /uninstall/i }));
    await user.click(await screen.findByRole('button', { name: /^yes/i }));

    // The dialog is dismissed mid-flight, so the card behind it — not the closed
    // dialog — has to carry the pending state through the rescan.
    await waitFor(() => expect(dialogEl()).toBeNull());
    expect(screen.getByRole('button', { name: /uninstalling/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^installed$/i })).not.toBeInTheDocument();

    finishScan(MOCK_INSTALLED_SCAN);
  });

  it('leaves the card closed when the overflow menu is used', async () => {
    const user = userEvent.setup();
    if (!scannedSkill) throw new Error('expected the find-skills fixture');

    render(
      <SkillCard
        skill={scannedSkill}
        snapshot={MOCK_INSTALLED_SCAN}
        providerFilter={ALL_AGENTS_FILTER_ID}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^installed$/i }));
    expect(await screen.findByRole('menuitem', { name: /uninstall/i })).toBeInTheDocument();
    expect(dialogEl()).toBeNull();
  });
});
