import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import type {
  EnrichmentRequired,
  SkillEnrichmentRecord,
} from './supabase-repository.js'

export type ExtractedEnrichment = {
  required: EnrichmentRequired
  optional: Record<string, unknown>
}

const enrichmentSchema = z.object({
  primaryGoal: z.string().min(1),
  requires: z.array(z.string()),
  estimatedComplexity: z.string().min(1),
  bestFor: z.array(z.string()),
  // Groq json_schema requires every `properties` key to appear in `required`
  // (no .optional()). Empty arrays mean "not present in the document".
  worksWith: z.array(z.string()),
  outputs: z.array(z.string()),
})

function cleanList(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].slice(
    0,
    12
  )
}

function firstMeaningfulParagraph(markdown: string): string {
  return (
    markdown
      .replace(/^---[\s\S]*?---/u, '')
      .split(/\n\s*\n/u)
      .filter(part => !part.trim().startsWith('#'))
      .map(part => part.replace(/[*_`]/gu, '').trim())
      .find(part => part.length > 10) ??
    'Provides reusable guidance for an AI-assisted development workflow.'
  ).slice(0, 300)
}

function listAfterLabel(markdown: string, labels: string[]): string[] {
  const label = labels.join('|')
  const match = markdown.match(
    new RegExp(`(?:${label})[^\\n]*\\n([\\s\\S]{0,500})`, 'iu')
  )
  if (!match?.[1]) return []
  return cleanList(
    match[1]
      .split(/\n(?=#+\s)/u)[0]
      .split('\n')
      .filter(line => /^\s*(?:[-*+] |\d+[.)] )/u.test(line))
      .map(line => line.replace(/^\s*(?:[-*+] |\d+[.)] )/u, ''))
  )
}

export function extractRuleBased(markdown: string): ExtractedEnrichment {
  const requires = listAfterLabel(markdown, [
    'requirements?',
    'prerequisites?',
    'requires',
    'dependencies',
  ])
  const bestFor = listAfterLabel(markdown, [
    'best for',
    'use when',
    'ideal for',
  ])
  const worksWith = listAfterLabel(markdown, ['works with', 'integrations?'])
  const outputs = listAfterLabel(markdown, ['outputs?', 'deliverables?'])
  const estimatedComplexity =
    markdown.length > 12000 ? 'high' : markdown.length > 5000 ? 'medium' : 'low'

  return {
    required: {
      primaryGoal: firstMeaningfulParagraph(markdown),
      requires,
      estimatedComplexity,
      bestFor,
    },
    optional: {
      ...(worksWith.length ? { worksWith } : {}),
      ...(outputs.length ? { outputs } : {}),
      confidence: 'rule-based',
    },
  }
}

export type EnrichModelFailure = {
  modelId: string
  message: string
  index: number
}

export async function enrichWithModel(
  markdown: string,
  models: LanguageModel[],
  ruleBased: ExtractedEnrichment = extractRuleBased(markdown),
  pause = async (milliseconds: number) =>
    new Promise<void>(resolve => setTimeout(resolve, milliseconds)),
  onModelFailure?: (failure: EnrichModelFailure) => void
): Promise<ExtractedEnrichment> {
  const prompt = `Extract structured metadata from this skill document. Preserve only facts supported by the document.\n\n${markdown.slice(0, 24000)}`
  let lastError: unknown

  for (const [index, model] of models.entries()) {
    const modelId =
      typeof model === 'object' &&
      model !== null &&
      'modelId' in model &&
      typeof model.modelId === 'string'
        ? model.modelId
        : `model-${index}`
    try {
      const result = await generateObject({
        model,
        schema: enrichmentSchema,
        prompt,
      })
      const { worksWith, outputs, ...required } = result.object
      return {
        required,
        optional: {
          ...(worksWith.length ? { worksWith } : {}),
          ...(outputs.length ? { outputs } : {}),
          confidence: 'llm',
          modelId,
        },
      }
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      onModelFailure?.({ modelId, message, index })
      if (index < models.length - 1) await pause(1000 * 2 ** index)
    }
  }

  if (models.length && lastError) return ruleBased
  return ruleBased
}

export function distilledEnrichmentText(
  enrichment: ExtractedEnrichment,
  record?: Pick<SkillEnrichmentRecord, 'skillId'>
): string {
  const { required, optional } = enrichment
  return [
    record?.skillId ? `Skill: ${record.skillId}` : '',
    `Goal: ${required.primaryGoal}`,
    `Requires: ${required.requires.join(', ') || 'not specified'}`,
    `Complexity: ${required.estimatedComplexity}`,
    `Best for: ${required.bestFor.join(', ') || 'general use'}`,
    optional.worksWith ? `Works with: ${String(optional.worksWith)}` : '',
    optional.outputs ? `Outputs: ${String(optional.outputs)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
