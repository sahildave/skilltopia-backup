import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GITHUB_REPO_URL } from '@/lib/desktop-download';
import { ProjectsView } from './ProjectsView';

const platformMock = vi.hoisted(() => ({
  hasLocalLibrary: false,
  openExternal: vi.fn(),
}));

vi.mock('@platform', () => ({ platform: platformMock }));

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
