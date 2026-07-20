export interface SkillsShSkill {
  id: string
  slug: string
  name: string
  source: string
  installs: number
  sourceType: string
  installUrl?: string | null
  url: string
  isDuplicate?: boolean | null
}

export interface SkillEnrichmentRequired {
  primaryGoal: string
  requires: string[]
  estimatedComplexity: string
  bestFor: string[]
}

export interface SkillEnrichment {
  skillId: string
  contentHash: string
  required: SkillEnrichmentRequired
  optional: unknown
  estimatedReadTimeMinutes: number
}

export interface RelatedSkill {
  skillId: string
  score: number
  repository: string | null
  sourceUrl: string | null
  installCount: number | null
}

export interface SkillDetailData {
  skillId: string
  enrichment: SkillEnrichment | null
  related: RelatedSkill[]
}

export interface CatalogPort {
  fetchLeaderboard(
    view: string,
    page: number,
    perPage: number
  ): Promise<SkillsShSkill[]>
  search(query: string, limit: number): Promise<SkillsShSkill[]>
  fetchDetail(skillId: string): Promise<SkillDetailData>
}
