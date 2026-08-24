import { UNIVERSAL_PROVIDER_ID } from '@/platform/types';
/**
 * Each icon is imported straight from its `components/Mono` module. The package
 * root re-exports `features/*`, and every icon's own `index` pulls in
 * `Avatar`/`Combine`, which import `antd`, `antd-style` and `@lobehub/ui` —
 * peer dependencies this app does not install. `Mono` needs nothing beyond
 * React, and mono is the variant we want anyway: it fills with `currentColor`,
 * so it dims and highlights with the row like the surrounding lucide icons.
 */
import Amp from '@lobehub/icons/es/Amp/components/Mono';
import Antigravity from '@lobehub/icons/es/Antigravity/components/Mono';
import ClaudeCode from '@lobehub/icons/es/ClaudeCode/components/Mono';
import Cline from '@lobehub/icons/es/Cline/components/Mono';
import CodeBuddy from '@lobehub/icons/es/CodeBuddy/components/Mono';
import Codex from '@lobehub/icons/es/Codex/components/Mono';
import Cursor from '@lobehub/icons/es/Cursor/components/Mono';
import Devin from '@lobehub/icons/es/Devin/components/Mono';
import GeminiCLI from '@lobehub/icons/es/GeminiCLI/components/Mono';
import GithubCopilot from '@lobehub/icons/es/GithubCopilot/components/Mono';
import Goose from '@lobehub/icons/es/Goose/components/Mono';
import Grok from '@lobehub/icons/es/Grok/components/Mono';
import HermesAgent from '@lobehub/icons/es/HermesAgent/components/Mono';
import IBM from '@lobehub/icons/es/IBM/components/Mono';
import Junie from '@lobehub/icons/es/Junie/components/Mono';
import KiloCode from '@lobehub/icons/es/KiloCode/components/Mono';
import Kimi from '@lobehub/icons/es/Kimi/components/Mono';
import Kiro from '@lobehub/icons/es/Kiro/components/Mono';
import Minimax from '@lobehub/icons/es/Minimax/components/Mono';
import Mistral from '@lobehub/icons/es/Mistral/components/Mono';
import OpenClaw from '@lobehub/icons/es/OpenClaw/components/Mono';
import OpenCode from '@lobehub/icons/es/OpenCode/components/Mono';
import OpenHands from '@lobehub/icons/es/OpenHands/components/Mono';
import Pi from '@lobehub/icons/es/Pi/components/Mono';
import Qoder from '@lobehub/icons/es/Qoder/components/Mono';
import Qwen from '@lobehub/icons/es/Qwen/components/Mono';
import Replit from '@lobehub/icons/es/Replit/components/Mono';
import RooCode from '@lobehub/icons/es/RooCode/components/Mono';
import Trae from '@lobehub/icons/es/Trae/components/Mono';
import Windsurf from '@lobehub/icons/es/Windsurf/components/Mono';
import Zencoder from '@lobehub/icons/es/Zencoder/components/Mono';
import { Bot, Globe } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { WarpIcon, ZedIcon } from './vendored-icons';

export type ProviderIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Keyed by provider id from `src/providers/registry.json`. */
export const PROVIDER_ICONS: Record<string, ProviderIconComponent> = {
  [UNIVERSAL_PROVIDER_ID]: Globe,
  amp: Amp,
  antigravity: Antigravity,
  'antigravity-cli': Antigravity,
  bob: IBM,
  'claude-code': ClaudeCode,
  cline: Cline,
  codebuddy: CodeBuddy,
  codex: Codex,
  cursor: Cursor,
  devin: Devin,
  'gemini-cli': GeminiCLI,
  'github-copilot': GithubCopilot,
  goose: Goose,
  grok: Grok,
  'hermes-agent': HermesAgent,
  junie: Junie,
  kilo: KiloCode,
  'kimi-code-cli': Kimi,
  'kiro-cli': Kiro,
  'minimax-code': Minimax,
  'mistral-vibe': Mistral,
  openclaw: OpenClaw,
  opencode: OpenCode,
  openhands: OpenHands,
  pi: Pi,
  qoder: Qoder,
  'qoder-cn': Qoder,
  'qwen-code': Qwen,
  replit: Replit,
  roo: RooCode,
  trae: Trae,
  'trae-cn': Trae,
  warp: WarpIcon,
  windsurf: Windsurf,
  zed: ZedIcon,
  zencoder: Zencoder,
};

/** Shown for providers with no brand icon, so every row keeps the same layout. */
export const FALLBACK_PROVIDER_ICON: ProviderIconComponent = Bot;
