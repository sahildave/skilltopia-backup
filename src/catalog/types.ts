export interface SkillsShSkill {
  id: string;
  slug: string;
  name: string;
  source: string;
  installs: number;
  sourceType: string;
  installUrl?: string | null;
  url: string;
  isDuplicate?: boolean | null;
}

export interface SkillEnrichmentRequired {
  primaryGoal: string;
  requires: string[];
  estimatedComplexity: string;
  bestFor: string[];
}

export interface SkillEnrichment {
  skillId: string;
  contentHash: string;
  required: SkillEnrichmentRequired;
  optional: unknown;
  estimatedReadTimeMinutes: number;
}

export interface RelatedSkill {
  skillId: string;
  score: number;
  repository: string | null;
  sourceUrl: string | null;
  installCount: number | null;
}

/** Sparse skills.sh HTML page snapshot; all fields optional. */
export interface SkillPageSnapshot {
  summary?: string;
  topics?: string[];
  repository?: string;
  stars?: number;
  firstSeen?: string;
  installCommand?: string;
  related?: unknown[];
  weeklyInstalls?: number[];
  skillMdPreview?: string;
}

export interface SkillDetailData {
  skillId: string;
  pageSnapshot: SkillPageSnapshot | null;
  pageScrapedAt: string | null;
  repository: string | null;
  installCount: number | null;
  sourceUrl: string | null;
  /** Up to 8 install counts for the sparkline (scraped weekly, else local snapshots). */
  installSeries: number[];
  enrichment: SkillEnrichment | null;
  related: RelatedSkill[];
}

export interface SkillAuditEntry {
  provider: string;
  slug: string;
  status: string;
  summary: string;
  auditedAt: string;
  riskLevel?: string;
  categories?: string[];
}

export interface SkillAuditsPayload {
  id: string;
  source: string;
  slug: string;
  audits: SkillAuditEntry[];
}

export interface SkillAuditsData {
  skillId: string;
  audits: SkillAuditsPayload | null;
  source: 'cache' | 'upstream';
  auditsFetchedAt: string | null;
}

export interface CatalogPort {
  fetchLeaderboard(view: string, page: number, perPage: number): Promise<SkillsShSkill[]>;
  search(query: string, limit: number): Promise<SkillsShSkill[]>;
  fetchDetail(skillId: string): Promise<SkillDetailData>;
  fetchAudits(skillId: string): Promise<SkillAuditsData>;
}
