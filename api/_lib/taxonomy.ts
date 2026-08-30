/**
 * Fixed, curated skill taxonomy. Source of truth for the `categories` a skill
 * carries. Based on lobehub's discover taxonomy, with its `all` filter pseudo-
 * category (the no-filter sentinel) and its product-specific entries
 * (`moltbook`, `clawdbot-tools`) dropped. A skill may hold several; the first
 * is treated as primary (drives the icon in the UI).
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
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

/**
 * One-line gloss per category, fed to the classifier prompt so the LLM
 * disambiguates neighbouring slugs (e.g. search-research vs browser-automation,
 * notes-pkm vs productivity-tasks). Keyed by SkillCategory, so a missing or
 * stray slug is a typecheck error.
 */
export const CATEGORY_GLOSS: Record<SkillCategory, string> = {
  'coding-agents-ides': 'AI coding agents, editors, and IDE integrations',
  'web-frontend-development': 'building web UIs, frontend frameworks, and styling',
  'devops-cloud': 'deploys, CI/CD, containers, infrastructure, and cloud platforms',
  'search-research': 'web search, retrieval, and gathering or synthesising information',
  'browser-automation': 'driving a real browser to navigate, scrape, or test pages',
  'productivity-tasks': 'to-dos, project trackers, and general task management',
  'ai-llms': 'LLM APIs, prompting, embeddings, and model tooling',
  'cli-utilities': 'general-purpose command-line tools and shell helpers',
  'git-github': 'version control, GitHub/GitLab, pull requests, and issues',
  'data-analytics': 'databases, SQL, dashboards, and data analysis',
  'image-video-generation': 'generating or editing images and video',
  'communication': 'chat, email, and messaging platforms',
  'pdf-documents': 'reading, writing, and converting documents and PDFs',
  'notes-pkm': 'note-taking and personal knowledge management',
  'calendar-scheduling': 'calendars, events, and scheduling',
  'marketing-sales': 'marketing, CRM, ads, and sales workflows',
  'finance': 'accounting, invoicing, payments, and financial data',
  'security-passwords': 'secrets, credentials, auth, and security tooling',
  'health-fitness': 'health tracking, fitness, and wellbeing',
  'media-streaming': 'music, video, and streaming media services',
  'speech-transcription': 'speech-to-text, transcription, and voice',
  'personal-development': 'learning, habits, and self-improvement',
  'shopping-ecommerce': 'shopping, storefronts, and e-commerce',
  'smart-home-iot': 'smart-home devices and IoT control',
  'self-hosted-automation': 'self-hosted services and workflow automation (e.g. n8n, Home Assistant)',
  'apple-apps-services': 'Apple first-party apps and services (Notes, Reminders, Mail)',
  'ios-macos-development': 'building and testing iOS and macOS apps',
  'transportation': 'maps, transit, rideshare, and travel logistics',
  'gaming': 'games and game-related tooling',
  'agent-to-agent-protocols': 'agent-to-agent messaging and interop protocols (e.g. MCP, A2A)',
};

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
