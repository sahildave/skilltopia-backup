import { render, screen, waitFor } from '@/test/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { SkillsDashboardView } from './SkillsDashboardView'
import { commands } from '@/lib/tauri-bindings'

describe('SkillsDashboardView', () => {
  it('renders all discovery rails and requests their matching views', async () => {
    render(<SkillsDashboardView />)

    expect(
      screen.getByRole('heading', { name: 'Top Installed' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Trending' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hot' })).toBeInTheDocument()

    await waitFor(() => {
      expect(commands.fetchSkillsLeaderboard).toHaveBeenCalledWith(
        'all-time',
        0,
        12
      )
      expect(commands.fetchSkillsLeaderboard).toHaveBeenCalledWith(
        'trending',
        0,
        12
      )
      expect(commands.fetchSkillsLeaderboard).toHaveBeenCalledWith('hot', 0, 12)
    })
  })

  it('keeps seeded skills visible when a leaderboard refresh fails', async () => {
    vi.mocked(commands.fetchSkillsLeaderboard).mockRejectedValueOnce(
      new Error('offline')
    )

    render(<SkillsDashboardView />)

    expect(screen.getAllByText('Find Skills')).toHaveLength(3)
    expect(await screen.findAllByText('Refresh failed')).toHaveLength(1)
  })
})
