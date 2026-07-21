/** skills.sh /audit cache: stale window, on-demand resolve, batch refresh. */

export const AUDIT_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export type SkillAuditEntry = {
  provider: string;
  slug: string;
  status: string;
  summary: string;
  auditedAt: string;
  riskLevel?: string;
  categories?: string[];
};

/** Cached skills.sh GET /api/v1/skills/audit/{id} payload. */
export type SkillAuditsPayload = {
  id: string;
  source: string;
  slug: string;
  audits: SkillAuditEntry[];
};

export type SkillAuditCacheRow = {
  contentHash: string | null;
  audits: SkillAuditsPayload | null;
  auditsFetchedAt: string | null;
};

export type AuditCacheRepository = {
  getSkillAuditCache(skillId: string): Promise<SkillAuditCacheRow | null>;
  upsertSkillAudits(
    skillId: string,
    audits: SkillAuditsPayload | null,
    fetchedAt?: string,
  ): Promise<void>;
};

export type ResolveSkillAuditsResult = {
  skillId: string;
  audits: SkillAuditsPayload | null;
  source: 'cache' | 'upstream';
  auditsFetchedAt: string | null;
};

export function shouldRefreshAudits(options: {
  hashChanged: boolean;
  audits: SkillAuditsPayload | null | undefined;
  auditsFetchedAt: string | null | undefined;
  now?: number;
}): boolean {
  if (options.hashChanged) return true;
  if (!options.audits) return true;
  if (!options.auditsFetchedAt) return true;
  const fetchedAt = Date.parse(options.auditsFetchedAt);
  if (Number.isNaN(fetchedAt)) return true;
  return (options.now ?? Date.now()) - fetchedAt >= AUDIT_STALE_MS;
}

function defaultSchedulePersist(task: () => Promise<void>): void {
  void task().catch(() => {
    // Fire-and-forget: UI already has audits; DB write is best-effort.
  });
}

export async function resolveSkillAudits(options: {
  skillId: string;
  repository: AuditCacheRepository;
  fetchAudits: (skillId: string) => Promise<SkillAuditsPayload | null>;
  schedulePersist?: (task: () => Promise<void>) => void;
  now?: number;
}): Promise<ResolveSkillAuditsResult> {
  const now = options.now ?? Date.now();
  const schedulePersist = options.schedulePersist ?? defaultSchedulePersist;
  const cached = await options.repository.getSkillAuditCache(options.skillId);

  if (
    cached?.audits &&
    !shouldRefreshAudits({
      hashChanged: false,
      audits: cached.audits,
      auditsFetchedAt: cached.auditsFetchedAt,
      now,
    })
  ) {
    return {
      skillId: options.skillId,
      audits: cached.audits,
      source: 'cache',
      auditsFetchedAt: cached.auditsFetchedAt,
    };
  }

  const audits = await options.fetchAudits(options.skillId);
  const auditsFetchedAt = audits ? new Date(now).toISOString() : null;

  if (audits) {
    schedulePersist(async () => {
      await options.repository.upsertSkillAudits(options.skillId, audits, auditsFetchedAt!);
    });
  }

  return {
    skillId: options.skillId,
    audits,
    source: 'upstream',
    auditsFetchedAt,
  };
}

export async function refreshSkillAuditsIfNeeded(options: {
  skillId: string;
  currentHash: string;
  /** Hash before this run's metadata upsert; when set, used for change detection. */
  previousContentHash?: string | null;
  /** Optional preloaded cache row to avoid a second read after metadata upsert. */
  cached?: SkillAuditCacheRow | null;
  repository: AuditCacheRepository;
  fetchAudits: (skillId: string) => Promise<SkillAuditsPayload | null>;
  now?: number;
}): Promise<{ refreshed: boolean; audits: SkillAuditsPayload | null }> {
  const now = options.now ?? Date.now();
  const cached =
    options.cached !== undefined
      ? options.cached
      : await options.repository.getSkillAuditCache(options.skillId);
  const previousHash =
    options.previousContentHash !== undefined ? options.previousContentHash : cached?.contentHash;
  const hashChanged = !previousHash || previousHash !== options.currentHash;

  if (
    !shouldRefreshAudits({
      hashChanged,
      audits: cached?.audits,
      auditsFetchedAt: cached?.auditsFetchedAt,
      now,
    })
  ) {
    return { refreshed: false, audits: cached?.audits ?? null };
  }

  const audits = await options.fetchAudits(options.skillId);
  if (!audits) return { refreshed: false, audits: null };

  const fetchedAt = new Date(now).toISOString();
  await options.repository.upsertSkillAudits(options.skillId, audits, fetchedAt);
  return { refreshed: true, audits };
}
