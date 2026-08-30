/**
 * Fixed, curated skill taxonomy. Source of truth for the `categories` a skill
 * carries. Matches lobehub's discover taxonomy; only its `all` filter pseudo-
 * category is excluded, since `all` is the "no filter" sentinel and never a
 * category a skill belongs to. A skill may hold several; the first is treated
 * as primary (drives the icon in the UI).
 *
 * This list is deliberately closed: the enrichment LLM must choose from it, and
 * the search endpoint validates category filters against it.
 */
export const SKILL_CATEGORIES = [
  'coding-agents-ides',
  'web-frontend-development',
  'devops-cloud',
  'search-research',
  'browser-automation',
  'productivity-tasks',
  'ai-llms',
  'cli-utilities',
  'git-github',
  'data-analytics',
  'image-video-generation',
  'communication',
  'pdf-documents',
  'notes-pkm',
  'calendar-scheduling',
  'marketing-sales',
  'finance',
  'security-passwords',
  'health-fitness',
  'media-streaming',
  'speech-transcription',
  'personal-development',
  'shopping-ecommerce',
  'smart-home-iot',
  'self-hosted-automation',
  'apple-apps-services',
  'ios-macos-development',
  'transportation',
  'gaming',
  'agent-to-agent-protocols',
  'clawdbot-tools',
  'moltbook',
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(SKILL_CATEGORIES);

export function isSkillCategory(value: string): value is SkillCategory {
  return CATEGORY_SET.has(value);
}

/** Narrow an unknown persisted value (e.g. `enrichment_optional.categories`) to valid slugs. */
export function toSkillCategories(value: unknown): SkillCategory[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is SkillCategory => typeof item === 'string' && isSkillCategory(item),
  );
}
