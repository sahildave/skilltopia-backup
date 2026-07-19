import { describe, expect, it, vi } from 'vitest'
import { runEnrichmentPipeline } from './enrichment-pipeline'

function detail(hash: string) {
  return {
    id: 'owner/skill',
    source: 'owner/repo',
    slug: 'skill',
    installs: 10,
    hash,
    files: [{ path: 'SKILL.md', contents: '# Skill\n\nBuild useful things.' }],
  }
}

describe('enrichment pipeline policy', () => {
  it('skips existing seed records but re-enriches changed sync records', async () => {
    const upsertSkillMetadata = vi.fn()
    const putRawSkillFiles = vi.fn()
    const upsertSkillEnrichment = vi.fn()
    const embed = vi.fn()
    const repository = {
      getSkillEnrichment: vi
        .fn()
        .mockResolvedValue({ contentHash: 'sha256:old' }),
      upsertSkillMetadata,
      putRawSkillFiles,
      upsertSkillEnrichment,
    } as never
    const common = {
      repository,
      models: [],
      maxEnriched: 1,
      throttleMs: 0,
      loadLeaderboard: async () => [detail('sha256:new')],
      loadDetail: async () => detail('sha256:new'),
      embed,
    }

    await expect(
      runEnrichmentPipeline({ ...common, mode: 'seed' })
    ).resolves.toMatchObject({ skipped: 1 })
    await expect(
      runEnrichmentPipeline({ ...common, mode: 'sync' })
    ).resolves.toMatchObject({ enriched: 1 })
    expect(upsertSkillMetadata).toHaveBeenCalledTimes(1)
    expect(embed).toHaveBeenCalledTimes(1)
  })
})
