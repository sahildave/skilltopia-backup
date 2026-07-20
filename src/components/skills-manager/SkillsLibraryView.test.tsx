import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download'
import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures'
import { useInstalledScanStore } from '@/store/installed-scan-store'
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store'
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model'
import { SkillsLibraryView } from './SkillsLibraryView'
import { SkillsSidebar } from './SkillsSidebar'

const scanMock = vi.hoisted(() => ({
  hasLocalLibrary: false as boolean,
  getInstalledScan: vi.fn(),
  scanInstalled: vi.fn(),
  revealProviderSkillsDir: vi.fn(),
  openExternal: vi.fn(),
}))

vi.mock('@platform', () => ({
  platform: {
    get hasLocalLibrary() {
      return scanMock.hasLocalLibrary
    },
    copiesInstallCommand: true,
    getInstalledScan: (...args: unknown[]) =>
      scanMock.getInstalledScan(...args),
    scanInstalled: (...args: unknown[]) => scanMock.scanInstalled(...args),
    revealProviderSkillsDir: (...args: unknown[]) =>
      scanMock.revealProviderSkillsDir(...args),
    listInstalled: vi.fn(),
    listProviders: vi.fn(),
    install: vi.fn(),
    openExternal: (...args: unknown[]) => scanMock.openExternal(...args),
  },
}))

describe('SkillsLibraryView (web)', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = false
    scanMock.openExternal.mockResolvedValue(undefined)
  })

  it('shows get-the-app messaging and opens the download link', async () => {
    const user = userEvent.setup()
    render(<SkillsLibraryView />)

    expect(
      screen.getByRole('heading', { name: 'Installed Skills' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/local skill library lives on disk/i)
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Get the desktop app' })
    )

    expect(scanMock.openExternal).toHaveBeenCalledWith(DESKTOP_APP_DOWNLOAD_URL)
  })
})

describe('SkillsLibraryView (local / mock)', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = true
    scanMock.scanInstalled.mockResolvedValue(MOCK_INSTALLED_SCAN)
    scanMock.getInstalledScan.mockResolvedValue(MOCK_INSTALLED_SCAN)
    scanMock.revealProviderSkillsDir.mockResolvedValue(true)
    useInstalledScanStore.setState({
      snapshot: MOCK_INSTALLED_SCAN,
      error: null,
      refreshing: false,
    })
    useInstalledSkillsUiStore.setState({
      providerFilter: ALL_AGENTS_FILTER_ID,
      showAllUniversal: false,
    })
  })

  it('lists All Agents skills with provider tags and no filesystem paths on cards', () => {
    render(<SkillsLibraryView />)

    expect(screen.getByText('find-skills')).toBeInTheDocument()
    expect(screen.getAllByText('[Universal]').length).toBeGreaterThan(0)
    expect(screen.getAllByText('[Claude Code]').length).toBeGreaterThan(0)

    const findSkillsCard = screen
      .getByText('find-skills')
      .closest('[data-slot="card"]')
    expect(findSkillsCard).toBeTruthy()
    expect(findSkillsCard?.textContent).not.toMatch(/\/Users\/mock/)
  })

  it('filters to a provider’s direct skills and reveals the path', async () => {
    const user = userEvent.setup()
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' })
    render(<SkillsLibraryView />)

    expect(screen.getByText('code-review')).toBeInTheDocument()
    expect(screen.getByText('find-skills')).toBeInTheDocument()
    expect(screen.queryByText('frontend-design')).not.toBeInTheDocument()

    await user.click(screen.getByTitle(/reveal in finder/i))
    expect(scanMock.revealProviderSkillsDir).toHaveBeenCalledWith('claude-code')
  })

  it('shows Universal Skills section when Show all Universal is enabled', async () => {
    const user = userEvent.setup()
    useInstalledSkillsUiStore.setState({ providerFilter: 'claude-code' })
    render(<SkillsLibraryView />)

    await user.click(
      screen.getByRole('switch', { name: /show all universal/i })
    )
    expect(screen.getByText('Universal Skills')).toBeInTheDocument()
    expect(screen.getByText('frontend-design')).toBeInTheDocument()
  })

  it('keeps prior results visible while refreshing', () => {
    useInstalledScanStore.setState({ refreshing: true })
    render(<SkillsLibraryView />)

    expect(screen.getByText('find-skills')).toBeInTheDocument()
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument()
  })
})

describe('SkillsSidebar providers', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = true
    useInstalledScanStore.setState({
      snapshot: MOCK_INSTALLED_SCAN,
      error: null,
      refreshing: false,
    })
    useInstalledSkillsUiStore.setState({
      providerFilter: ALL_AGENTS_FILTER_ID,
      showAllUniversal: false,
    })
  })

  it('shows Universal, active providers, and inactive group', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SkillsSidebar active="library" onSelect={onSelect} />)

    expect(screen.getByText('Installed Skills')).toBeInTheDocument()
    expect(screen.getByText('All Agents')).toBeInTheDocument()
    expect(screen.getByText('Universal')).toBeInTheDocument()
    expect(screen.getByText('Claude Code')).toBeInTheDocument()
    expect(screen.getByText('Cursor')).toBeInTheDocument()

    await user.click(screen.getByText('Other providers'))
    expect(screen.getByLabelText(/search providers/i)).toBeInTheDocument()
  })

  it('selects a provider without requiring a new scan to finish first', async () => {
    const user = userEvent.setup()
    render(<SkillsSidebar active="library" onSelect={vi.fn()} />)

    await user.click(screen.getByText('Claude Code'))
    expect(useInstalledSkillsUiStore.getState().providerFilter).toBe(
      'claude-code'
    )
  })
})

describe('Installed Skills activation rescan', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = true
    scanMock.scanInstalled.mockResolvedValue(MOCK_INSTALLED_SCAN)
    useInstalledScanStore.setState({
      snapshot: null,
      error: null,
      refreshing: false,
    })
  })

  it('rescans when the Installed Skills tab becomes active', async () => {
    const { SkillsContent } = await import('./SkillsContent')
    render(<SkillsContent active="library" />)

    await waitFor(() => {
      expect(scanMock.scanInstalled).toHaveBeenCalled()
    })
  })
})
