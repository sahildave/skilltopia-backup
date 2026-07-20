export type QueryErrorBody = {
  error: string;
  message: string;
};

export type QueryParseResult =
  | { ok: true; query: URLSearchParams }
  | { ok: false; status: 400; body: QueryErrorBody };

const LEADERBOARD_VIEWS = new Set(['all-time', 'trending', 'hot']);
const LEADERBOARD_KEYS = new Set(['view', 'page', 'per_page']);
const SEARCH_KEYS = new Set(['q', 'limit', 'owner']);
const DETAIL_KEYS = new Set(['skill_id']);

function invalid(message: string): QueryParseResult {
  return {
    ok: false,
    status: 400,
    body: { error: 'invalid_query', message },
  };
}

function rejectUnknownKeys(params: URLSearchParams, allowed: Set<string>): QueryParseResult | null {
  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      return invalid(`Unknown query parameter: ${key}`);
    }
  }
  return null;
}

function parseNonNegativeInt(
  value: string,
  name: string,
): { ok: true; value: number } | { ok: false; result: QueryParseResult } {
  if (!/^\d+$/.test(value)) {
    return { ok: false, result: invalid(`${name} must be an integer`) };
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    return { ok: false, result: invalid(`${name} must be an integer`) };
  }
  return { ok: true, value: n };
}

export function parseSkillsLeaderboardQuery(params: URLSearchParams): QueryParseResult {
  const unknown = rejectUnknownKeys(params, LEADERBOARD_KEYS);
  if (unknown) return unknown;

  const cleaned = new URLSearchParams();

  const view = params.get('view');
  if (view !== null) {
    if (!LEADERBOARD_VIEWS.has(view)) {
      return invalid('view must be one of: all-time, trending, hot');
    }
    cleaned.set('view', view);
  }

  const page = params.get('page');
  if (page !== null) {
    const parsed = parseNonNegativeInt(page, 'page');
    if (!parsed.ok) return parsed.result;
    cleaned.set('page', String(parsed.value));
  }

  const perPage = params.get('per_page');
  if (perPage !== null) {
    const parsed = parseNonNegativeInt(perPage, 'per_page');
    if (!parsed.ok) return parsed.result;
    if (parsed.value < 1 || parsed.value > 500) {
      return invalid('per_page must be between 1 and 500');
    }
    cleaned.set('per_page', String(parsed.value));
  }

  return { ok: true, query: cleaned };
}

export function parseSkillsSearchQuery(params: URLSearchParams): QueryParseResult {
  const unknown = rejectUnknownKeys(params, SEARCH_KEYS);
  if (unknown) return unknown;

  const q = params.get('q');
  if (q === null || q.length < 2) {
    return invalid('q must be at least 2 characters');
  }

  const cleaned = new URLSearchParams();
  cleaned.set('q', q);

  const limit = params.get('limit');
  if (limit !== null) {
    const parsed = parseNonNegativeInt(limit, 'limit');
    if (!parsed.ok) return parsed.result;
    if (parsed.value < 1 || parsed.value > 200) {
      return invalid('limit must be between 1 and 200');
    }
    cleaned.set('limit', String(parsed.value));
  }

  const owner = params.get('owner');
  if (owner !== null) {
    cleaned.set('owner', owner);
  }

  return { ok: true, query: cleaned };
}

export function parseSkillDetailQuery(params: URLSearchParams): QueryParseResult {
  const unknown = rejectUnknownKeys(params, DETAIL_KEYS);
  if (unknown) return unknown;

  const skillId = params.get('skill_id')?.trim();
  if (!skillId) return invalid('skill_id is required');
  // skills.sh ids are slash paths: owner/skill or owner/repo/skill
  if (skillId.length > 200 || !/^[^/\s]+(?:\/[^/\s]+)+$/u.test(skillId)) {
    return invalid('skill_id must be a slash-separated path (e.g. owner/repo/skill)');
  }

  const cleaned = new URLSearchParams();
  cleaned.set('skill_id', skillId);
  return { ok: true, query: cleaned };
}
