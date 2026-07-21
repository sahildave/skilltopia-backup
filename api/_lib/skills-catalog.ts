import type { SkillAuditsPayload } from './audit-cache.js';

const SKILLS_API_BASE = 'https://skills.sh/api/v1';

export type LeaderboardView = 'all-time' | 'trending' | 'hot';

export type CatalogSkill = {
  id: string;
  source: string;
  slug: string;
  name?: string;
  installs: number;
  sourceType?: string;
  installUrl?: string;
  url?: string;
};

export type SkillDetail = CatalogSkill & {
  hash: string | null;
  files: Array<{ path: string; contents: string }> | null;
};

export type { SkillAuditsPayload };

type FetchCatalog = (url: string) => Promise<unknown>;

function authHeaders(): HeadersInit {
  const token = process.env.VERCEL_OIDC_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!response.ok) throw new Error(`skills.sh request failed: ${response.status}`);
  return response.json();
}

export async function fetchLeaderboardPage(
  view: LeaderboardView,
  page = 0,
  perPage = 500,
  fetcher: FetchCatalog = fetchJson,
): Promise<CatalogSkill[]> {
  const body = (await fetcher(
    `${SKILLS_API_BASE}/skills?view=${view}&page=${page}&per_page=${perPage}`,
  )) as {
    data?: CatalogSkill[];
  };
  return body.data ?? [];
}

/** Walk pages until a short page (per_page max 500). */
export async function fetchAllLeaderboard(
  view: LeaderboardView,
  perPage = 500,
  fetcher: FetchCatalog = fetchJson,
): Promise<CatalogSkill[]> {
  const skills: CatalogSkill[] = [];
  let page = 0;
  while (true) {
    const batch = await fetchLeaderboardPage(view, page, perPage, fetcher);
    skills.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return skills;
}

export async function fetchLeaderboard(
  perPage = 500,
  fetcher: FetchCatalog = fetchJson,
): Promise<CatalogSkill[]> {
  return fetchLeaderboardPage('all-time', 0, perPage, fetcher);
}

export async function fetchSkillDetail(
  skillId: string,
  fetcher: FetchCatalog = fetchJson,
): Promise<SkillDetail> {
  const body = (await fetcher(`${SKILLS_API_BASE}/skills/${skillId}`)) as SkillDetail;
  if (!body.id) throw new Error(`Skill detail missing id: ${skillId}`);
  return body;
}

export async function fetchSkillAudits(
  skillId: string,
  fetcher: FetchCatalog = fetchJson,
): Promise<SkillAuditsPayload | null> {
  try {
    const body = (await fetcher(
      `${SKILLS_API_BASE}/skills/audit/${skillId}`,
    )) as SkillAuditsPayload;
    if (!body.id) throw new Error(`Skill audit missing id: ${skillId}`);
    return body;
  } catch (error) {
    if (error instanceof Error && /:\s*404\b/.test(error.message)) return null;
    throw error;
  }
}
