const SKILLS_API_BASE = 'https://skills.sh/api/v1'

export type CatalogSkill = {
  id: string
  source: string
  slug: string
  name?: string
  installs: number
  sourceType?: string
  installUrl?: string
  url?: string
}

export type SkillDetail = CatalogSkill & {
  hash: string | null
  files: Array<{ path: string; contents: string }> | null
}

type FetchCatalog = (url: string) => Promise<unknown>

function authHeaders(): HeadersInit {
  const token = process.env.VERCEL_OIDC_TOKEN
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...authHeaders() },
  })
  if (!response.ok)
    throw new Error(`skills.sh request failed: ${response.status}`)
  return response.json()
}

export async function fetchLeaderboard(
  perPage = 500,
  fetcher: FetchCatalog = fetchJson
): Promise<CatalogSkill[]> {
  const body = (await fetcher(
    `${SKILLS_API_BASE}/skills?view=all-time&per_page=${perPage}`
  )) as { data?: CatalogSkill[] }
  return body.data ?? []
}

export async function fetchSkillDetail(
  skillId: string,
  fetcher: FetchCatalog = fetchJson
): Promise<SkillDetail> {
  const body = (await fetcher(
    `${SKILLS_API_BASE}/skills/${skillId}`
  )) as SkillDetail
  if (!body.id || !body.files)
    throw new Error(`Skill has no snapshot: ${skillId}`)
  return body
}
