import { describe, expect, it, vi } from 'vitest'
import {
  createModelsFromEnv,
  maxEnrichedFromEnv,
  MAX_ENRICHED,
  runEnrichmentPipeline,
} from './enrichment-pipeline.js'

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
      'openai/gpt-oss-20b',
      'gemini-3.1-flash-lite',
    ])
  })

  it('keeps nested Groq model ids (openai/gpt-oss-20b)', () => {
    const models = createModelsFromEnv({
      ENRICHMENT_MODEL_CHAIN: 'groq/openai/gpt-oss-20b',
      GROQ_API_KEY: 'groq-key',
    })

    expect(models.map(model => model.modelId)).toEqual(['openai/gpt-oss-20b'])
  })

  it('force mode re-enriches even when content hash is unchanged', async () => {
    const upsertSkillEnrichment = vi.fn()
    const repository = {
      getSkillEnrichment: vi
        .fn()
        .mockResolvedValue({ contentHash: 'sha256:same' }),
      upsertSkillMetadata: vi.fn(),
      putRawSkillFiles: vi.fn(),
      upsertSkillEnrichment,
    } as never

    await expect(
      runEnrichmentPipeline({
        repository,
        models: [],
        maxEnriched: 1,
        throttleMs: 0,
        mode: 'force',
        loadLeaderboard: async () => [detail('sha256:same')],
        loadDetail: async () => detail('sha256:same'),
        embed: vi.fn(),
      })
    ).resolves.toMatchObject({ enriched: 1, skipped: 0 })
    expect(upsertSkillEnrichment).toHaveBeenCalledTimes(1)
  })

  it('reads MAX_ENRICHED from env and caps at the hard limit', () => {
    expect(maxEnrichedFromEnv({ MAX_ENRICHED: '20' })).toBe(20)
    expect(maxEnrichedFromEnv({ MAX_ENRICHED: '9999' })).toBe(MAX_ENRICHED)
    expect(maxEnrichedFromEnv({ MAX_ENRICHED: '0' })).toBe(MAX_ENRICHED)
    expect(maxEnrichedFromEnv({ MAX_ENRICHED: 'nope' })).toBe(MAX_ENRICHED)
    expect(maxEnrichedFromEnv({})).toBe(MAX_ENRICHED)
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
