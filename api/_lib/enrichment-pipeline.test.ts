import { describe, expect, it, vi } from 'vitest'
import {
  createModelsFromEnv,
  runEnrichmentPipeline,
} from './enrichment-pipeline'

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
  it('resolves the configured provider chain and skips missing keys', () => {
    const models = createModelsFromEnv({
      ENRICHMENT_MODEL_CHAIN:
        'gemini/gemini-test,groq/llama-test,openai/gpt-test',
      GOOGLE_GENERATIVE_AI_API_KEY: 'google-key',
      GROQ_API_KEY: 'groq-key',
    })

    expect(models).toHaveLength(2)
    expect(models.map(model => model.modelId)).toEqual([
      'gemini-test',
      'llama-test',
    ])
  })

  it('uses Groq then Gemini by default', () => {
    const models = createModelsFromEnv({
      GROQ_API_KEY: 'groq-key',
      GOOGLE_GENERATIVE_AI_API_KEY: 'google-key',
    })

    expect(models.map(model => model.modelId)).toEqual([
      'llama-3.1-8b-instant',
      'gemini-2.5-flash-lite',
    ])
  })

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
