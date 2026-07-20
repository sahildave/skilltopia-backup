import { render, screen } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { platform } from '@platform'
import { DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download'
import { SkillsLibraryView } from './SkillsLibraryView'

vi.mock('@platform', () => ({
  platform: {
    hasLocalLibrary: false,
    copiesInstallCommand: true,
    listInstalled: vi.fn(),
    listProviders: vi.fn(),
    install: vi.fn(),
    openExternal: vi.fn(),
  },
}))

describe('SkillsLibraryView (web)', () => {
  beforeEach(() => {
    vi.mocked(platform.openExternal).mockResolvedValue(undefined)
  })

  it('shows get-the-app messaging and opens the download link', async () => {
    const user = userEvent.setup()
    render(<SkillsLibraryView />)

    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
    expect(
      screen.getByText(/local skill library lives on disk/i)
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Get the desktop app' })
    )

    expect(platform.openExternal).toHaveBeenCalledWith(DESKTOP_APP_DOWNLOAD_URL)
  })
})
