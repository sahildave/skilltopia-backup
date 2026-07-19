import {
  enforceRateLimit,
  methodNotAllowed,
  proxySkillsRequest,
} from '../_lib/proxy'
import { mergeHybridSearchResults } from '../_lib/hybrid-search'
import { searchSkillsByText } from '../_lib/qdrant'
import { createSupabaseRepositoryFromEnv } from '../_lib/supabase-repository'
import { parseSkillsSearchQuery } from '../_lib/query'

/**
 * Searches skills.sh keywords and merges semantic matches from the enriched
 * Qdrant subset. Semantic search is best-effort so keyword search remains
 * available when the vector store is empty or unavailable.
 * Query allowlist: q, limit, owner
 */
export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request)
  if (limited) return limited

  const parsed = parseSkillsSearchQuery(new URL(request.url).searchParams)
  if (!parsed.ok) {
    return Response.json(parsed.body, { status: parsed.status })
  }

  const keywordResponse = await proxySkillsRequest(
    '/skills/search',
    parsed.query
  )
  if (!keywordResponse.ok) return keywordResponse

  const keywordBody = (await keywordResponse.json()) as { data?: unknown[] }
  const keywordResults = (keywordBody.data ?? []).filter(
    (result): result is { id: string; installs: number } =>
      typeof result === 'object' &&
      result !== null &&
      typeof result.id === 'string' &&
      typeof result.installs === 'number'
  )
  const limit = Number(parsed.query.get('limit') ?? 50)
  const owner = parsed.query.get('owner')

  try {
    const semanticResults = await searchSkillsByText(
      parsed.query.get('q')!,
      limit
    )
    const repository = createSupabaseRepositoryFromEnv()
    const metadata = (
      await repository.getSkillMetadata(
        semanticResults.map(result => result.skillId)
      )
    ).filter(item => !owner || item.skillId.split('/')[0] === owner)
    const merged = mergeHybridSearchResults(
      parsed.query.get('q')!,
      keywordResults,
      semanticResults,
      metadata.map(item => ({
        skillId: item.skillId,
        source: item.repository,
        installCount: item.installCount,
        sourceUrl: item.sourceUrl,
      })),
      limit
    )
    const headers = new Headers(keywordResponse.headers)
    headers.set('Content-Type', 'application/json')
    return new Response(JSON.stringify({ ...keywordBody, data: merged }), {
      status: keywordResponse.status,
      headers,
    })
  } catch {
    const headers = new Headers(keywordResponse.headers)
    headers.set('Content-Type', 'application/json')
    return new Response(
      JSON.stringify({ ...keywordBody, data: keywordResults.slice(0, limit) }),
      { status: keywordResponse.status, headers }
    )
  }
}

export async function POST(): Promise<Response> {
  return methodNotAllowed()
}
