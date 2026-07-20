# AI Agent Instructions

## Overview

This repository is a template with sensible defaults for building Tauri React apps.

**Chrome-first UI:** Day-to-day React work runs in Chrome via `npm run dev` / `dev:web` (TARGET=web). Use Tauri for filesystem, install, opener, and desktop chrome. See `docs/developer/web-and-desktop.md`. Shared UI imports only `@platform` / `@catalog` — never `@tauri-apps/*` on those paths.

## Vocabulary

- **Backend API**: The Vercel-hosted HTTP API under `api/`. It owns all secrets and env (skills.sh auth, Supabase, Qdrant, AI provider keys). The Tauri desktop app and web UI never hold those credentials; they only call the Backend API.
- **Infisical**: Source of truth for secrets. Backend keys live in Infisical `dev` / `prod` (synced to Vercel); desktop-safe vars only in Infisical `local`. See `docs/developer/infisical.md`. Never put Backend secrets in the Tauri process.
- Do not say “Vercel API” in plans/tasks when you mean this — use **Backend API**. (“Vercel” is the host; **Backend API** is our product surface.)

## Core Rules

### New Sessions

- Read @CODING_STANDARD.md for how code should be written (judgement standards)
- Read @docs/tasks.md for task management
- Review `docs/developer/architecture-guide.md` for high-level patterns
- Check `docs/developer/README.md` for the full documentation index
- Check git status and project structure

### Development Practices

**CRITICAL:** Follow these strictly:

0. **Use npm only**: This project uses `npm`, NOT `pnpm`. Always use `npm install`, `npm run`, etc.
1. **Coding Standards**: Follow `@CODING_STANDARD.md` for all code judgement. Where it conflicts with a generic smell heuristic, the coding standard wins.
2. **Read Before Editing**: Always read files first to understand context
3. **Follow Established Patterns**: Use patterns from this file, `CODING_STANDARD.md`, and `docs/developer`
4. **Senior Architect Mindset**: Consider performance, maintainability, testability
5. **Batch Operations**: Use multiple tool calls in single responses
6. **Match Code Style**: Follow existing formatting and patterns
7. **Test Coverage**: Write comprehensive tests for business logic
8. **Quality Gates**: Run `npm run check:all` after significant changes
9. **No Dev Server**: Ask user to run and report back
10. **No Unsolicited Commits**: Only when explicitly requested
11. **Documentation**: Update relevant `docs/developer/` files for new patterns
12. **Removing files**: Always use `rm -f`

**CRITICAL:** Use Tauri v2 docs only. Always use modern Rust formatting: `format!("{variable}")`

### UI & Animation Skills (CRITICAL)

**CRITICAL:** When doing UI work, always read and follow these skills before implementing:

- `/shadcn` — component selection, composition, and styling rules
- `/baseline-ui` — baseline UI constraints (layout, interaction, a11y, anti-slop)

**CRITICAL:** When adding or changing animations/motion, always read and follow these skills before implementing:

- `/apple-design` — fluid interaction and motion principles
- `/improve-animations` — audit-then-plan workflow for motion improvements
- `/mastering-animate-presence` — AnimatePresence / exit animation rules

## Architecture Patterns (CRITICAL)

### State Management Onion

```
useState (component) → Zustand (global UI) → TanStack Query (persistent data)
```

**Decision**: Is data needed across components? → Does it persist between sessions?

### Performance Pattern (CRITICAL)

```typescript
// ✅ GOOD: Selector syntax - only re-renders when specific value changes
const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)

// ❌ BAD: Destructuring causes render cascades (caught by ast-grep)
const { leftSidebarVisible } = useUIStore()

// ✅ GOOD: Use getState() in callbacks for current state
const handleAction = () => {
  const { data, setData } = useStore.getState()
  setData(newData)
}
```

### Static Analysis

- **React Compiler**: Handles memoization automatically - no manual `useMemo`/`useCallback` needed
- **ast-grep**: Enforces architecture patterns (e.g., no Zustand destructuring). See `docs/developer/static-analysis.md`
- **Knip/jscpd**: Periodic cleanup tools. Use `/cleanup` command (Claude Code)

### Event-Driven Bridge

- **Rust → React**: `app.emit("event-name", data)` → `listen("event-name", handler)`
- **React → Rust**: Use typed commands from `@/lib/tauri-bindings` (tauri-specta)
- **Commands**: All actions flow through centralized command system

### Tauri Command Pattern (tauri-specta)

```typescript
// ✅ GOOD: Type-safe commands with Result handling
import { commands } from '@/lib/tauri-bindings'

const result = await commands.loadPreferences()
if (result.status === 'ok') {
  console.log(result.data.theme)
}

// ❌ BAD: String-based invoke (no type safety)
const prefs = await invoke('load_preferences')
```

**Adding commands**: See `docs/developer/tauri-commands.md`

### Internationalization (i18n)

```typescript
// ✅ GOOD: Use useTranslation hook in React components
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t('myFeature.title')}</h1>
}

// ✅ GOOD: Non-React contexts - bind for many calls, or use directly
import i18n from '@/i18n/config'
const t = i18n.t.bind(i18n)  // Bind once for many translations
i18n.t('key')                 // Or call directly for occasional use
```

- **Translations**: All strings in `/locales/*.json`
- **RTL Support**: Use CSS logical properties (`text-start` not `text-left`)
- **Adding strings**: See `docs/developer/i18n-patterns.md`

### Documentation & Versions

- **Context7 First**: Always use Context7 for framework docs before WebSearch
- **Version Requirements**: Tauri v2.x, shadcn/ui v4.x, Tailwind v4.x, React 19.x, Zustand v5.x, Vite v7.x, Vitest v4.x

## Developer Documentation

For complete patterns and detailed guidance, see `docs/developer/README.md`.

Key documents:

- `CODING_STANDARD.md` - Code judgement standards (source of truth for `/code-review` Standards axis)
- `architecture-guide.md` - Mental models, security, anti-patterns
- `state-management.md` - State onion, getState() pattern details
- `tauri-commands.md` - Adding new Rust commands
- `static-analysis.md` - All linting tools and quality gates

## Claude Code Skills & Agents

These are specific to Claude Code but documented here for context.

### Skills

- `/init` - One-time template initialization (includes package manager selection)
- `/check` - Check work against architecture, run `npm run check:all`, suggest commit message
- `/cleanup` - Run static analysis (knip, jscpd, check:all), get structured recommendations
- `/change-package-manager <bun|pnpm|npm>` - Switch package manager across all config, scripts, docs, CI, and AI instructions
- `/shadcn` - shadcn/ui components, composition, and styling (required for UI work)
- `/baseline-ui` - baseline UI constraints (required for UI work)
- `/apple-design` - fluid interaction and motion principles (required for animation work)
- `/improve-animations` - audit-then-plan workflow for motion (required for animation work)
- `/mastering-animate-presence` - AnimatePresence / exit animation rules (required for animation work)

### Agents

Task-focused agents that leverage separate context for focused work:

- `cleanup-analyzer` - Analyze static analysis output (used by `/cleanup`)
- `userguide-reviewer` - Review user guide against actual system features
