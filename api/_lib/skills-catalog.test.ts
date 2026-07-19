import { describe, expect, it } from 'vitest'
import { fetchLeaderboard, fetchSkillDetail } from './skills-catalog.js'

describe('skills catalog client', () => {
  it('loads leaderboard and detail response shapes', async () => {
    const responses: unknown[] = [
      {
        data: [
          {
            id: 'owner/skill',
            source: 'owner/repo',
            slug: 'skill',
            installs: 3,
          },
        ],
      },
      {
        id: 'owner/skill',
        source: 'owner/repo',
        slug: 'skill',
        installs: 3,
        hash: 'sha256:abc',
        files: [{ path: 'SKILL.md', contents: '# Skill' }],
      },
    ]
    const fetcher = async () => responses.shift()
    await expect(fetchLeaderboard(1, fetcher)).resolves.toHaveLength(1)
    await expect(
      fetchSkillDetail('owner/skill', fetcher)
    ).resolves.toMatchObject({ hash: 'sha256:abc' })
  })
})
