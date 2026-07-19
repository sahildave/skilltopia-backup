import { describe, expect, it, vi } from 'vitest'
import {
  createSupabaseRepository,
  estimateReadTimeMinutes,
  type RawSkillFile,
  type SkillEnrichmentRecord,
} from './supabase-repository.js'

function createClient() {
  const metadata = {
    upsert: vi.fn(),
    select: vi.fn(),
  }
  const rawFiles = {
    upsert: vi.fn(),
    select: vi.fn(),
  }
  const storageBucket = {
    upload: vi.fn(),
    download: vi.fn(),
  }

  return {
    from: vi.fn((table: string) =>
      table === 'skill_metadata' ? metadata : rawFiles
    ),
    storage: {
      from: vi.fn(() => storageBucket),
    },
    metadata,
    rawFiles,
    storageBucket,
  }
}

const enrichment: SkillEnrichmentRecord = {
  skillId: 'owner/skill',
  contentHash: 'sha256:abc',
  required: {
    primaryGoal: 'Improve code quality',
    requires: ['TypeScript'],
    estimatedComplexity: 'medium',
    bestFor: ['developers'],
  },
  optional: { worksWith: ['React'] },
  estimatedReadTimeMinutes: 2,
}

const enrichmentRow = {
  skill_id: enrichment.skillId,
  content_hash: enrichment.contentHash,
  enrichment_required: enrichment.required,
  enrichment_optional: enrichment.optional,
  estimated_read_time_minutes: enrichment.estimatedReadTimeMinutes,
}

describe('Supabase skill repository', () => {
  it('derives a minimum one-minute read time from content length', () => {
    expect(estimateReadTimeMinutes('one two three')).toBe(1)
    expect(
      estimateReadTimeMinutes(
        Array.from({ length: 201 }, () => 'word').join(' ')
      )
    ).toBe(2)
  })

  it('upserts and reads enrichment by skill id', async () => {
    const client = createClient()
    client.metadata.upsert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: enrichmentRow, error: null }),
      }),
    })
    client.metadata.select.mockReturnValue({
      eq: () => ({
        maybeSingle: async () => ({ data: enrichmentRow, error: null }),
      }),
    })

    const repository = createSupabaseRepository(client as never)

    await expect(repository.upsertSkillEnrichment(enrichment)).resolves.toEqual(
      enrichment
    )
    await expect(
      repository.getSkillEnrichment(enrichment.skillId)
    ).resolves.toEqual(enrichment)
    expect(client.metadata.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        skill_id: enrichment.skillId,
        enrichment_required: enrichment.required,
        enrichment_optional: enrichment.optional,
      }),
      { onConflict: 'skill_id' }
    )
  })

  it('distinguishes missing enrichment from a content-hash match', async () => {
    const client = createClient()
    client.metadata.select
      .mockReturnValueOnce({
        is: () => ({
          order: () => ({
            limit: async () => ({
              data: [{ skill_id: 'missing/skill' }],
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        eq: () => ({
          not: () => ({
            order: async () => ({ data: [enrichmentRow], error: null }),
          }),
        }),
      })

    const repository = createSupabaseRepository(client as never)

    await expect(repository.listMissingEnrichment()).resolves.toEqual([
      { skillId: 'missing/skill' },
    ])
    await expect(
      repository.getByContentHash(enrichment.contentHash)
    ).resolves.toEqual([enrichment])
  })

  it('stores raw files in Storage and reloads them through the repository', async () => {
    const client = createClient()
    client.storageBucket.upload.mockResolvedValue({ data: {}, error: null })
    client.storageBucket.download.mockResolvedValue({
      data: new Blob(['# Skill']),
      error: null,
    })
    client.rawFiles.upsert.mockReturnValue({
      data: [],
      error: null,
    })
    client.rawFiles.select.mockReturnValue({
      eq: () => ({
        order: async () => ({
          data: [
            { file_path: 'SKILL.md', storage_path: 'owner/skill/SKILL.md' },
          ],
          error: null,
        }),
      }),
    })

    const files: RawSkillFile[] = [{ path: 'SKILL.md', content: '# Skill' }]
    const repository = createSupabaseRepository(client as never)

    await repository.putRawSkillFiles(enrichment.skillId, files)
    await expect(
      repository.getRawSkillFiles(enrichment.skillId)
    ).resolves.toEqual({
      'SKILL.md': '# Skill',
    })
    expect(client.storageBucket.upload).toHaveBeenCalledWith(
      'owner/skill/SKILL.md',
      '# Skill',
      expect.objectContaining({ contentType: 'text/markdown', upsert: true })
    )
  })
})
