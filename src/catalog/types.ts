import type { SkillCategory } from '../../api/_lib/taxonomy';

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
  /** Taxonomy slugs from the enrichment record, most representative first. */
  categories?: SkillCategory[];
}

export interface CatalogSearchResult {
  skills: SkillsShSkill[];
  /** True when the semantic leg failed and the response is keyword-only. */
  semanticUnavailable: boolean;
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
  source: string | null;
  sourceUrl: string | null;
  installCount: number | null;
}

/** Sparse skills.sh HTML page snapshot; all fields optional. */
export interface SkillPageSnapshot {
  summary?: string;
  topics?: string[];
  repository?: string;
  source?: string;
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
  source: string | null;
  installCount: number | null;
  sourceUrl: string | null;
  /** Up to 8 install counts for the sparkline (scraped weekly, else local snapshots). */
  installSeries: number[];
  enrichment: SkillEnrichment | null;
  related: RelatedSkill[];
}

export type {
  SkillAuditEntry,
  SkillAuditStatus,
  SkillAuditsPayload,
} from '../../api/_lib/audit-cache';

import type { SkillAuditStatus, SkillAuditsPayload } from '../../api/_lib/audit-cache';

export function isPassAuditStatus(
  status: string,
): status is Extract<SkillAuditStatus, 'pass' | 'passed'> {
  return status === 'pass' || status === 'passed';
}

export interface SkillAuditsData {
  skillId: string;
  audits: SkillAuditsPayload | null;
  source: 'cache' | 'upstream';
  auditsFetchedAt: string | null;
}

export interface CatalogPort {
  fetchLeaderboard(view: string, page: number, perPage: number): Promise<SkillsShSkill[]>;
  /** `categories` narrows the search to those taxonomy slugs; empty means no facet. */
  search(query: string, limit: number, categories: SkillCategory[]): Promise<CatalogSearchResult>;
  fetchDetail(skillId: string): Promise<SkillDetailData>;
  fetchAudits(skillId: string): Promise<SkillAuditsData>;
}
