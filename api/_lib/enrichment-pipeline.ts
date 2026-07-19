import { createGoogle } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
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
export type EnrichmentMode = 'seed' | 'sync' | 'force'
export type EnrichmentLogLevel = 'info' | 'ok' | 'warn' | 'error' | 'step'

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
  log?: (message: string, level?: EnrichmentLogLevel) => void
}

/** Default chain uses Groq models that support json_schema (generateObject). */
export const DEFAULT_ENRICHMENT_MODEL_CHAIN =
  'groq/openai/gpt-oss-20b,gemini/gemini-2.5-flash'

/** Reads `MAX_ENRICHED` from env; invalid/missing → default; always capped at `MAX_ENRICHED`. */
export function maxEnrichedFromEnv(environment = process.env): number {
  const raw = environment.MAX_ENRICHED?.trim()
  if (!raw) return MAX_ENRICHED
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return MAX_ENRICHED
  return Math.min(parsed, MAX_ENRICHED)
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
  const names = (
    environment.ENRICHMENT_MODEL_CHAIN ?? DEFAULT_ENRICHMENT_MODEL_CHAIN
  )
    .split(',')
    .map(model => model.trim())
    .filter(Boolean)
  const models: LanguageModel[] = []
  const providers = new Map<string, (model: string) => LanguageModel>()

  for (const entry of names) {
    const [providerName, ...modelParts] = entry.split('/')
    const provider = providerName.toLowerCase()
    const modelName = modelParts.join('/').trim()

    if (provider === 'groq') {
      const apiKey = environment.GROQ_API_KEY?.trim()
      if (!apiKey) continue
      const factory =
        providers.get(provider) ??
        (createGroq({ apiKey }) as unknown as (model: string) => LanguageModel)
      providers.set(provider, factory)
      // llama-* on Groq does not support response_format=json_schema (generateObject).
      models.push(factory(modelName || 'openai/gpt-oss-20b'))
      continue
    }

    if (provider === 'gemini' || provider === 'google') {
      const apiKey = environment.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
      if (!apiKey) continue
      const factory =
        providers.get(provider) ??
        (createGoogle({ apiKey }) as unknown as (
          model: string
        ) => LanguageModel)
      providers.set(provider, factory)
      models.push(factory(modelName || 'gemini-2.5-flash'))
      continue
    }

    if (provider === 'openai') {
      const apiKey = environment.OPENAI_API_KEY?.trim()
      if (!apiKey || !modelName) continue
      const factory =
        providers.get(provider) ??
        (createOpenAI({
          apiKey,
          ...(environment.OPENAI_BASE_URL?.trim()
            ? { baseURL: environment.OPENAI_BASE_URL.trim() }
            : {}),
        }) as unknown as (model: string) => LanguageModel)
      providers.set(provider, factory)
      models.push(factory(modelName))
    }
  }

  return models
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
  const log = options.log ?? (() => {})
  const result: EnrichmentRunResult = {
    attempted: 0,
    enriched: 0,
    skipped: 0,
    failed: [],
  }

  log(
    `start mode=${mode} maxEnriched=${maxEnriched} models=${options.models.length} throttleMs=${throttleMs}`,
    'info'
  )
  if (options.models.length === 0) {
    log('no LLM providers resolved from env — will use rule-based only', 'warn')
  } else {
    log(
      `providers: ${options.models.map(model => ('modelId' in model ? String(model.modelId) : 'unknown')).join(' → ')}`,
      'info'
    )
  }
  log('fetching leaderboard from skills.sh…', 'step')
  const skills = (await loadLeaderboard(maxEnriched)).slice(0, maxEnriched)
  log(`leaderboard returned ${skills.length} skill(s)`, 'ok')

  for (const [index, skill] of skills.entries()) {
    const step = `[${index + 1}/${skills.length}] ${skill.id}`
    result.attempted += 1
    try {
      log(`${step}: fetching detail…`, 'step')
      const detail = await loadDetail(skill.id)
      const source = metadata(detail)
      log(`${step}: checking existing enrichment…`, 'step')
      const existing = await options.repository.getSkillEnrichment(detail.id)
      if (
        existing &&
        mode !== 'force' &&
        (mode === 'seed' || existing.contentHash === source.contentHash)
      ) {
        result.skipped += 1
        log(`${step}: skipped (already enriched)`, 'warn')
        continue
      }

      log(`${step}: upserting metadata + raw files…`, 'step')
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
      log(`${step}: running model/rule enrichment…`, 'step')
      const enrichment = await enrichWithModel(
        markdown,
        options.models,
        undefined,
        undefined,
        failure => {
          log(`${step}: ${failure.modelId} failed — ${failure.message}`, 'warn')
        }
      )
      const confidence = String(enrichment.optional.confidence ?? 'unknown')
      log(
        `${step}: confidence=${confidence}`,
        confidence === 'llm' ? 'ok' : 'warn'
      )
      log(`${step}: persisting enrichment…`, 'step')
      await options.repository.upsertSkillEnrichment({
        ...source,
        ...enrichment,
        estimatedReadTimeMinutes: estimateReadTimeMinutes(markdown),
      })
      log(`${step}: upserting Qdrant embedding…`, 'step')
      await embed(
        detail.id,
        distilledEnrichmentText(enrichment, { skillId: detail.id })
      )
      result.enriched += 1
      log(`${step}: enriched`, 'ok')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.failed.push({
        skillId: skill.id,
        message,
      })
      log(`${step}: failed — ${message}`, 'error')
    }
    if (throttleMs > 0) {
      log(`${step}: throttling ${throttleMs}ms…`, 'step')
      await sleep(throttleMs)
    }
  }
  log(
    `done attempted=${result.attempted} enriched=${result.enriched} skipped=${result.skipped} failed=${result.failed.length}`,
    result.failed.length > 0 ? 'warn' : 'ok'
  )
  return result
}

type LocalEnrichmentOptions = Omit<
  EnrichmentPipelineOptions,
  'repository' | 'models' | 'mode'
> &
  Partial<Pick<EnrichmentPipelineOptions, 'repository' | 'models'>>

function withLocalDefaults(
  options: LocalEnrichmentOptions,
  mode: EnrichmentMode = 'seed'
): EnrichmentPipelineOptions {
  return {
    repository: options.repository ?? createSupabaseRepositoryFromEnv(),
    models: options.models ?? createModelsFromEnv(),
    ...options,
    mode,
    maxEnriched: options.maxEnriched ?? maxEnrichedFromEnv(),
  }
}

export async function runLocalEnrichment(
  options: LocalEnrichmentOptions = {}
): Promise<EnrichmentRunResult> {
  return runEnrichmentPipeline(withLocalDefaults(options, 'seed'))
}

// The sync stub reuses the same bounded runner but changes the skip policy to hash comparison.
export async function runEnrichmentSync(
  options: LocalEnrichmentOptions = {}
): Promise<EnrichmentRunResult> {
  return runEnrichmentPipeline(withLocalDefaults(options, 'sync'))
}

/** Re-enrich regardless of existing rows / content hash (e.g. after fixing model config). */
export async function runEnrichmentForce(
  options: LocalEnrichmentOptions = {}
): Promise<EnrichmentRunResult> {
  return runEnrichmentPipeline(withLocalDefaults(options, 'force'))
}
