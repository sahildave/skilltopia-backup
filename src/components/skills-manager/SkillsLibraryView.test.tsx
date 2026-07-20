import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download'
import { MOCK_EMPTY_SCAN, MOCK_INSTALLED_SCAN } from '@/platform/fixtures'
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types'
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

  it('disables reveal when the selected provider directory is missing', async () => {
    const user = userEvent.setup()
    useInstalledScanStore.setState({ snapshot: MOCK_EMPTY_SCAN })
    useInstalledSkillsUiStore.setState({ providerFilter: UNIVERSAL_PROVIDER_ID })
    render(<SkillsLibraryView />)

    expect(screen.getByTitle(/directory is missing/i)).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /open folder/i }))
    expect(scanMock.revealProviderSkillsDir).toHaveBeenCalledWith('universal')
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

  it('resets Show all Universal when changing providers', async () => {
    const user = userEvent.setup()
    useInstalledSkillsUiStore.setState({
      providerFilter: 'claude-code',
      showAllUniversal: true,
    })
    render(
      <>
        <SkillsSidebar active="library" onSelect={vi.fn()} />
        <SkillsLibraryView />
      </>
    )

    expect(
      screen.getByRole('switch', { name: /show all universal/i })
    ).toBeChecked()
    await user.click(
      screen.getAllByRole('button', { name: /Claude Code/i })[0]!
    )
    expect(useInstalledSkillsUiStore.getState().showAllUniversal).toBe(false)
  })

  it('manual Rescan replaces the shared snapshot while keeping prior cards', async () => {
    const user = userEvent.setup()
    let resolveScan: (value: typeof MOCK_EMPTY_SCAN) => void = () => undefined
    scanMock.scanInstalled.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveScan = resolve
        })
    )
    render(<SkillsLibraryView />)

    await user.click(screen.getByRole('button', { name: /rescan/i }))
    expect(screen.getByText('find-skills')).toBeInTheDocument()
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument()

    resolveScan(MOCK_EMPTY_SCAN)
    await waitFor(() => {
      expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_EMPTY_SCAN)
    })
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

  it('shows Universal, filled providers, and collapsible other providers', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SkillsSidebar active="library" onSelect={onSelect} />)

    expect(screen.getByText('Installed Skills')).toBeInTheDocument()
    expect(screen.getByText('All Agents')).toBeInTheDocument()
    expect(screen.getByText('Universal')).toBeInTheDocument()
    expect(screen.getByText('Claude Code')).toBeInTheDocument()
    expect(screen.queryByText('Cursor')).not.toBeInTheDocument()

    const allAgents = screen.getByText('All Agents').closest('button')
    expect(allAgents).toHaveTextContent('3')
    const universal = screen.getByText('Universal').closest('button')
    expect(universal).toHaveTextContent('2')

    await user.click(screen.getByText('Other providers'))
    expect(screen.getByLabelText(/search providers/i)).toBeInTheDocument()
    expect(screen.getByText('Cursor')).toBeInTheDocument()
    const cursorRow = screen.getByText('Cursor').closest('button')
    expect(cursorRow).toHaveTextContent('0')
  })

  it('selects a provider from the in-memory snapshot without scanning', async () => {
    const user = userEvent.setup()
    scanMock.scanInstalled.mockClear()
    scanMock.getInstalledScan.mockClear()
    render(<SkillsSidebar active="library" onSelect={vi.fn()} />)

    await user.click(screen.getByText('Claude Code'))
    expect(useInstalledSkillsUiStore.getState().providerFilter).toBe(
      'claude-code'
    )
    expect(scanMock.scanInstalled).not.toHaveBeenCalled()
    expect(scanMock.getInstalledScan).not.toHaveBeenCalled()
  })
})

describe('Installed Skills shared snapshot lifecycle', () => {
  beforeEach(() => {
    scanMock.hasLocalLibrary = true
    scanMock.scanInstalled.mockReset()
    scanMock.getInstalledScan.mockReset()
    scanMock.scanInstalled.mockResolvedValue(MOCK_INSTALLED_SCAN)
    scanMock.getInstalledScan.mockResolvedValue(MOCK_INSTALLED_SCAN)
    useInstalledScanStore.setState({
      snapshot: null,
      error: null,
      refreshing: false,
    })
  })

  it('rescans when the Installed Skills tab becomes active (app-open default)', async () => {
    const { SkillsContent } = await import('./SkillsContent')
    render(<SkillsContent active="library" />)

    await waitFor(() => {
      expect(scanMock.scanInstalled).toHaveBeenCalled()
    })
    expect(useInstalledScanStore.getState().snapshot).toEqual(
      MOCK_INSTALLED_SCAN
    )
  })

  it('keeps prior results visible while Installed Skills activation rescans', async () => {
    useInstalledScanStore.setState({ snapshot: MOCK_INSTALLED_SCAN })
    let resolveScan: (value: typeof MOCK_EMPTY_SCAN) => void = () => undefined
    scanMock.scanInstalled.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveScan = resolve
        })
    )

    const { SkillsContent } = await import('./SkillsContent')
    render(<SkillsContent active="library" />)

    expect(screen.getByText('find-skills')).toBeInTheDocument()
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument()
    expect(scanMock.scanInstalled).toHaveBeenCalled()

    resolveScan(MOCK_EMPTY_SCAN)
    await waitFor(() => {
      expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_EMPTY_SCAN)
    })
  })

  it('hydrates the cached platform snapshot when Installed Skills is not active', async () => {
    scanMock.getInstalledScan.mockResolvedValue(MOCK_INSTALLED_SCAN)
    const { SkillsContent } = await import('./SkillsContent')
    render(<SkillsContent active="dashboard" />)

    await waitFor(() => {
      expect(scanMock.getInstalledScan).toHaveBeenCalled()
    })
    expect(scanMock.scanInstalled).not.toHaveBeenCalled()
    expect(useInstalledScanStore.getState().snapshot).toEqual(
      MOCK_INSTALLED_SCAN
    )
  })
})
