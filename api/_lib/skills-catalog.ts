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

/**
 * Public skills.sh HTML page URL.
 * List responses include `url`; detail omits it — reconstruct from id shape.
 * GitHub: `owner/repo/skill` → `https://www.skills.sh/{id}`
 * Well-known: `domain.com/skill` → `https://www.skills.sh/site/{id}`
 * Path segments are percent-encoded (e.g. `react:components` → `react%3Acomponents`).
 */
export function skillPageUrl(skillId: string, knownUrl?: string | null): string {
  const trimmed = knownUrl?.trim();
  if (trimmed) return trimmed;
  const segments = skillId.split('/').filter(Boolean);
  const encodedPath = segments.map((segment) => encodeURIComponent(segment)).join('/');
  if (segments.length === 2) {
    return `https://www.skills.sh/site/${encodedPath}`;
  }
  return `https://www.skills.sh/${encodedPath}`;
}

export type ClassifiedOrigin = {
  repository?: string;
  source?: string;
};

function looksLikeHost(value: string): boolean {
  if (/^https?:\/\//iu.test(value)) return true;
  const host = value.split('/')[0] ?? '';
  return /^[a-z0-9.-]+\.[a-z]{2,}$/iu.test(host);
}

/** Prefer absolute URLs for external Source values. */
export function normalizeExternalSource(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//iu.test(trimmed)) return trimmed;
  if (looksLikeHost(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/**
 * Split skills.sh API `source` into GitHub `repository` vs external `source`.
 * Well-known ids (`domain.com/skill`) and host/URL values → source;
 * `owner/repo` (and GitHub skill ids) → repository.
 */
export function classifySkillOrigin(
  skillId: string,
  apiSource: string | null | undefined,
): ClassifiedOrigin {
  const trimmed = apiSource?.trim();
  if (!trimmed) return {};

  const segments = skillId.split('/').filter(Boolean);
  const isWellKnown = segments.length === 2 && (segments[0]?.includes('.') ?? false);

  if (isWellKnown || looksLikeHost(trimmed)) {
    return { source: normalizeExternalSource(trimmed) };
  }

  return { repository: trimmed };
}

/**
 * Batch/backend OIDC is intentionally separate from the app Backend OIDC.
 *
 * skills.sh rate-limits OIDC by Vercel team+project. User-facing web/desktop
 * traffic uses the primary app Backend project via `@vercel/oidc`; batch jobs
 * such as scrape, list snapshots, rotation, enrichment, and GHA ingest should
 * use a secondary ingest project token so they cannot consume the app budget.
 *
 * `VERCEL_OIDC_TOKEN` remains as a fallback for older environments, but new
 * batch setups should provide `VERCEL_OIDC_TOKEN_SECONDARY`.
 */
export function resolveBatchOidcToken(): string | undefined {
  const secondary = process.env.VERCEL_OIDC_TOKEN_SECONDARY?.trim();
  if (secondary) return secondary;
  const fallback = process.env.VERCEL_OIDC_TOKEN?.trim();
  return fallback || undefined;
}

function authHeaders(): HeadersInit {
  const token = resolveBatchOidcToken();
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
    const batch = await fetchLeaderboardPage(view, page, Math.min(perPage, 500), fetcher);
    skills.push(...batch);
    if (batch.length < Math.min(perPage, 500)) break;
    page += 1;
  }
  return skills;
}

/**
 * Top `limit` all-time skills (paginates; skills.sh `per_page` max is 500).
 * Callers that need >500 (e.g. scrape sweep toward 1500) rely on this.
 */
export async function fetchLeaderboard(
  limit = 500,
  fetcher: FetchCatalog = fetchJson,
): Promise<CatalogSkill[]> {
  const perPage = 500;
  const skills: CatalogSkill[] = [];
  let page = 0;
  while (skills.length < limit) {
    const batch = await fetchLeaderboardPage('all-time', page, perPage, fetcher);
    skills.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return skills.slice(0, limit);
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
