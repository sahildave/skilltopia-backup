import {
  Apple,
  Bot,
  Calendar,
  Car,
  ChartBar,
  Clapperboard,
  Cloud,
  CodeXml,
  FileText,
  Gamepad2,
  GitBranch,
  GraduationCap,
  HeartPulse,
  House,
  Image,
  ListChecks,
  Megaphone,
  MessageCircle,
  Mic,
  MousePointerClick,
  Network,
  NotebookPen,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Terminal,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SKILL_CATEGORIES, type SkillCategory } from '../../api/_lib/taxonomy';

/**
 * Icon per taxonomy slug. Keyed by `SkillCategory`, so adding or renaming a slug
 * in `api/_lib/taxonomy.ts` is a typecheck error here until the icon follows.
 */
const CATEGORY_ICONS: Record<SkillCategory, LucideIcon> = {
  'coding-agents-ides': Bot,
  'web-frontend-development': CodeXml,
  'devops-cloud': Cloud,
  'search-research': Search,
  'browser-automation': MousePointerClick,
  'productivity-tasks': ListChecks,
  'ai-llms': Sparkles,
  'cli-utilities': Terminal,
  'git-github': GitBranch,
  'data-analytics': ChartBar,
  'image-video-generation': Image,
  communication: MessageCircle,
  'pdf-documents': FileText,
  'notes-pkm': NotebookPen,
  'calendar-scheduling': Calendar,
  'marketing-sales': Megaphone,
  finance: Wallet,
  'security-passwords': ShieldCheck,
  'health-fitness': HeartPulse,
  'media-streaming': Clapperboard,
  'speech-transcription': Mic,
  'personal-development': GraduationCap,
  'shopping-ecommerce': ShoppingCart,
  'smart-home-iot': House,
  'self-hosted-automation': Workflow,
  'apple-apps-services': Apple,
  'ios-macos-development': Smartphone,
  transportation: Car,
  gaming: Gamepad2,
  'agent-to-agent-protocols': Network,
};

export interface SkillCategoryBinding {
  key: SkillCategory;
  icon: LucideIcon;
  label: string;
}

/** Every taxonomy slug bound to its icon and localized label, in taxonomy order. */
export function useSkillCategories(): SkillCategoryBinding[] {
  const { t } = useTranslation();

  return SKILL_CATEGORIES.map((key) => ({
    key,
    icon: CATEGORY_ICONS[key],
    label: t(`skillCategory.${key}`),
  }));
}

/**
 * Binding for a skill's primary category — `categories[0]` drives the icon.
 * Returns `null` for a skill with no categories or an unrecognised slug.
 */
export function useSkillCategory(categories: readonly string[]): SkillCategoryBinding | null {
  const bindings = useSkillCategories();
  const primary = categories[0];

  return bindings.find((binding) => binding.key === primary) ?? null;
}
