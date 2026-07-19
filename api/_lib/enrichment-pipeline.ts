import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { createHash } from 'node:crypto'
import { distilledEnrichmentText, enrichWithModel } from './enrichment'
import { fetchLeaderboard, fetchSkillDetail } from './skills-catalog'
import {
  createSupabaseRepositoryFromEnv,
  estimateReadTimeMinutes,
  type SkillSourceMetadata,
} from './supabase-repository'
import { upsertSkillEmbedding } from './qdrant'

export const MAX_ENRICHED = 500
type Repository = ReturnType<typeof createSupabaseRepositoryFromEnv>
export type EnrichmentMode = 'seed' | 'sync'

export type EnrichmentPipelineOptions = {
  repository: Repository
  models: LanguageModel[]
  maxEnriched?: number
  throttleMs?: number
  mode?: EnrichmentMode
  embed?: typeof upsertSkillEmbedding
  loadLeaderboard?: typeof fetchLeaderboard
  loadDetail?: typeof fetchSkillDetail
  sleep?: (milliseconds: number) => Promise<void>
}

export type EnrichmentRunResult = {
  attempted: number
  enriched: number
  skipped: number
  failed: Array<{ skillId: string; message: string }>
}

function hashFiles(files: Array<{ path: string; contents: string }>): string {
  const hash = createHash('sha256')
  for (const file of [...files].sort((left, right) =>
    left.path.localeCompare(right.path)
  )) {
    hash.update(file.path).update('\0').update(file.contents).update('\0')
  }
  return `sha256:${hash.digest('hex')}`
}

function metadata(
  detail: Awaited<ReturnType<typeof fetchSkillDetail>>
): SkillSourceMetadata {
  return {
    skillId: detail.id,
    contentHash: detail.hash ?? hashFiles(detail.files ?? []),
    sourceUrl: detail.url,
    repository: detail.source,
    installCount: detail.installs,
    rawStoragePrefix: detail.id,
  }
}

export function createModelsFromEnv(
  environment = process.env
): LanguageModel[] {
  const apiKey = environment.OPENAI_API_KEY?.trim()
  if (!apiKey) return []
  const names = (environment.ENRICHMENT_MODEL_CHAIN ?? 'gpt-4o-mini')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean)
  const provider = createOpenAI({
    apiKey,
    ...(environment.OPENAI_BASE_URL?.trim()
      ? { baseURL: environment.OPENAI_BASE_URL.trim() }
      : {}),
  })
  return names.map(name => provider(name))
}

export async function runEnrichmentPipeline(
  options: EnrichmentPipelineOptions
): Promise<EnrichmentRunResult> {
  const mode = options.mode ?? 'seed'
  const maxEnriched = Math.min(
    options.maxEnriched ?? MAX_ENRICHED,
    MAX_ENRICHED
  )
  const throttleMs = options.throttleMs ?? 1000
  const sleep =
    options.sleep ??
    (async ms => new Promise(resolve => setTimeout(resolve, ms)))
  const loadLeaderboard = options.loadLeaderboard ?? fetchLeaderboard
  const loadDetail = options.loadDetail ?? fetchSkillDetail
  const embed = options.embed ?? upsertSkillEmbedding
  const result: EnrichmentRunResult = {
    attempted: 0,
    enriched: 0,
    skipped: 0,
    failed: [],
  }

  for (const skill of (await loadLeaderboard(maxEnriched)).slice(
    0,
    maxEnriched
  )) {
    result.attempted += 1
    try {
      const detail = await loadDetail(skill.id)
      const source = metadata(detail)
      const existing = await options.repository.getSkillEnrichment(detail.id)
      if (
        existing &&
        (mode === 'seed' || existing.contentHash === source.contentHash)
      ) {
        result.skipped += 1
        continue
      }

      await options.repository.upsertSkillMetadata(source)
      const files = detail.files ?? []
      await options.repository.putRawSkillFiles(
        detail.id,
        files.map(file => ({ path: file.path, content: file.contents }))
      )
      const markdown =
        files.find(file => file.path.toLowerCase() === 'skill.md')?.contents ??
        ''
      if (!markdown.trim()) throw new Error('Skill detail has no SKILL.md')
      const enrichment = await enrichWithModel(markdown, options.models)
      await options.repository.upsertSkillEnrichment({
        ...source,
        ...enrichment,
        estimatedReadTimeMinutes: estimateReadTimeMinutes(markdown),
      })
      await embed(
        detail.id,
        distilledEnrichmentText(enrichment, { skillId: detail.id })
      )
      result.enriched += 1
    } catch (error) {
      result.failed.push({
        skillId: skill.id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
    if (throttleMs > 0) await sleep(throttleMs)
  }
  return result
}

export async function runLocalEnrichment(
  options: Omit<EnrichmentPipelineOptions, 'repository' | 'models'> &
    Partial<Pick<EnrichmentPipelineOptions, 'repository' | 'models'>> = {}
): Promise<EnrichmentRunResult> {
  return runEnrichmentPipeline({
    repository: options.repository ?? createSupabaseRepositoryFromEnv(),
    models: options.models ?? createModelsFromEnv(),
    ...options,
  })
}

// The sync stub reuses the same bounded runner but changes the skip policy to hash comparison.
export async function runEnrichmentSync(
  options: Omit<EnrichmentPipelineOptions, 'mode'>
): Promise<EnrichmentRunResult> {
  return runEnrichmentPipeline({ ...options, mode: 'sync' })
}
