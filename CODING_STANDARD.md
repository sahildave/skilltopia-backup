# Coding Standards

How code should be written in this repo. This document is the source of truth
for the **Standards** axis of `/code-review`; where it endorses something a
generic smell heuristic would flag, this document wins.

Mechanics (formatting, import order, unused vars, hook rules, Zustand selector
syntax, Rust fmt/clippy) are enforced by ESLint, Prettier, ast-grep, TypeScript,
cargo fmt, and clippy. Don't restate what tooling already checks — this document
covers judgement, not mechanics. See `docs/developer/static-analysis.md`.

## 1. Simplicity first

- Write the minimum code that solves the problem. Nothing speculative.
- No abstractions for single-use code; no configurability that wasn't asked for.
- No error handling for impossible scenarios.
- If it's 200 lines and could be 50, rewrite it.

## 2. Surgical changes

- Touch only what the task requires. Don't "improve" adjacent code.
- Match existing style, even if you'd do it differently.
- Remove imports/variables your change orphaned; leave pre-existing dead code
  alone (mention it instead).

## 3. TypeScript & React (project conventions)

- TypeScript everywhere. Prefer `type` over `interface` (except when you need
  declaration merging, e.g. extending a third-party library).
- Avoid enums; use maps or string-literal unions.
- Functional, declarative code; avoid classes (except when a library requires
  them, e.g. `ErrorBoundary`).
- Functional components with typed props. Use the `function` keyword for
  components and pure functions.
- Named exports for components (`export function Foo`, not `export default`).
- Directories: lowercase-with-dashes (e.g. `components/skills-manager`).
- Descriptive names with auxiliary verbs (`isLoading`, `hasError`).
- Declarative JSX; avoid unnecessary curly braces in simple conditionals.
- React Compiler handles memoization — do not add manual `useMemo` /
  `useCallback` unless profiling proves a need.

## 4. Tauri / React desktop

- Follow the state onion: `useState` → Zustand (global UI) → TanStack Query
  (persistent data). Put state in the thinnest layer that works.
- Zustand: selector syntax only; use `getState()` inside callbacks. Never
  destructure the whole store.
- Call Rust via typed `commands` from `@/lib/tauri-bindings` (tauri-specta).
  Never string-based `invoke`.
- Prefer event + command patterns for Rust ↔ React; don't couple UI directly
  to backend details.
- User-facing strings go through i18n (`useTranslation` / `i18n.t`). Use CSS
  logical properties (`text-start`, not `text-left`).
- Desktop UI: fixed-size window, not viewport-responsive web layout. Prefer CSS
  visibility toggles over remounting panels that should keep state.
- Tauri v2 only. Rust: modern formatting (`format!("{variable}")`), validate
  untrusted input in Rust, atomic disk writes.
- For framework details, prefer `docs/developer/` and Context7 over inventing
  patterns. See `AGENTS.md` for the pattern index.

## 5. Design smells (judgement layer)

These are heuristics from Fowler's _Refactoring_ (ch. 3), not hard rules. Each
is a judgement call; a documented standard above overrides any of them.

- **Mysterious Name** — name doesn't reveal intent → rename.
- **Duplicated Code** — same shape in multiple places → extract, call from both.
- **Feature Envy** — a method reaching into another object's data → move it.
- **Data Clumps** — the same fields always travel together → bundle into a type.
- **Primitive Obsession** — a primitive standing in for a domain concept → give
  the concept its own small type.
- **Repeated Switches** — the same switch/if-cascade recurs → map or polymorphism.
- **Shotgun Surgery** — one change forces scattered edits → gather them together.
- **Divergent Change** — one module edited for unrelated reasons → split it.
- **Speculative Generality** — abstraction for needs that don't exist → delete it.
- **Message Chains** — long `a.b().c().d()` navigation → hide behind one method.
- **Middle Man** — mostly delegates onward → cut it, call the real target.
- **Refused Bequest** — ignores most of what it inherits → use composition.

## 6. Module design

Prefer **deep modules**: a lot of behaviour behind a small interface at a clean
seam. Push complexity down behind adapters rather than leaking it to callers.
