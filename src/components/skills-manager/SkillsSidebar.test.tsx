import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillsSidebar } from './SkillsSidebar';

const updatesMock = vi.hoisted(() => ({
  requestManualUpdateCheck: vi.fn(),
  hasController: true,
}));

vi.mock('@/platform/updates', () => ({
  requestManualUpdateCheck: (...args: unknown[]) => updatesMock.requestManualUpdateCheck(...args),
  // Mirror the real selector hook: hand the selector a state whose controller
  // presence the test drives.
  useUpdateStore: (selector: (state: { controller: unknown }) => unknown) =>
    selector({ controller: updatesMock.hasController ? {} : null }),
}));

vi.mock('@platform', () => ({
  platform: { openExternal: vi.fn() },
}));

describe('SkillsSidebar footer actions', () => {
  beforeEach(() => {
    updatesMock.requestManualUpdateCheck.mockClear();
    updatesMock.hasController = true;
  });

  it('runs a manual update check from the More actions menu', async () => {
    const user = userEvent.setup();
    render(<SkillsSidebar active="explore" onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /check for updates/i }));

    await waitFor(() => expect(updatesMock.requestManualUpdateCheck).toHaveBeenCalledTimes(1));
  });

  it('hides the actions menu when no update controller is mounted (web shell)', () => {
    updatesMock.hasController = false;
    render(<SkillsSidebar active="explore" onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });
});
