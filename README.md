# Skilltopia

Skilltopia is a desktop and web app for discovering, reviewing, and installing agent skills. It helps developers browse the public skills catalog, inspect skill details and audit metadata, and manage locally installed global skills from one interface.

Skilltopia is created by Coduo Studio, LLC. The main creators are [Sahil Dave](https://github.com/sahildave) and [Indhuja](https://github.com/indhuja).

The app has two runtime targets:

- **Web**: browse and search the live catalog in Chrome during development.
- **Desktop**: run the Tauri app to scan local skill directories, install skills, and use native desktop integrations.

Desktop downloads will be published from [GitHub Releases](https://github.com/sahildave/skills-explorer/releases) once the first signed build is available. Until then, clone the repo and run locally.

Public site: [skilltopia.coduo.co](https://skilltopia.coduo.co)

TODO: rename the GitHub repository from `sahildave/skills-explorer` to `sahildave/skilltopia` and update links to `https://github.com/sahildave/skilltopia`.

## Stack

| Layer    | Technologies                               |
| -------- | ------------------------------------------ |
| Frontend | React 19, TypeScript, Vite                 |
| UI       | Tailwind CSS, shadcn/ui, Lucide React      |
| Desktop  | Tauri v2, Rust                             |
| Data     | Backend API, Supabase, Qdrant              |
| Quality  | Vitest, ESLint, Prettier, ast-grep, clippy |

## Quick Start

Prerequisites:

- Node.js 20 or newer
- Rust stable and the Tauri platform prerequisites for your OS
- npm

Run the web app:

```bash
git clone https://github.com/sahildave/skills-explorer.git
cd skills-explorer
npm install
npm run dev
```

Run the desktop app:

```bash
npm run tauri:dev
```

The desktop command expects local desktop-safe environment variables to be injected through Infisical. See [docs/developer/infisical.md](docs/developer/infisical.md) before adding or changing secrets.

## Development

Daily drivers:

```bash
npm run dev             # Web target on Vite
npm run dev:mock        # Web target with mocked platform/catalog adapters
npm run dev:all         # Web + Tauri
npm run dev:all:design  # Web + Tauri + design watcher
npm run tauri:dev       # Desktop target with deployed Backend API
npm run dev:local:proxy # Local Backend API + Tauri pointed at :3000
npm run ingest:daily    # Daily list + scrape rotation
npm run scrape:sweep    # One-shot corpus scrape
npm run check:all       # Full local quality gate
```

Helper scripts:

```bash
npm run dev:local            # Alias for tauri:dev
npm run proxy:dev            # Backend API only
npm run tauri:dev:local      # Tauri → :3000
npm run scrape:local         # Bounded page-cache scrape
npm run list-snapshots:local # List endpoint snapshots
npm run rotate:local         # Daily rotation slice
```

Shared UI code imports platform-specific behavior through `@platform` and catalog access through `@catalog`. Do not import `@tauri-apps/*` from shared React paths; keep desktop-only behavior behind the platform adapter.

`dev:all` does not run `proxy:dev`; use `dev:local:proxy` for a local Backend API.

## Catalog Cache and Scraping

Skilltopia uses the skills.sh APIs for live catalog data and a bounded HTML scrape/cache pipeline for richer detail pages: summaries, topics, repository/source labels, SKILL.md previews, related skills, and weekly install series.

Scraped page snapshots are cached in Supabase so detail pages stay fast and clients never hold skills.sh credentials.

Batch scraping is deliberately separated from user-facing traffic:

- Primary Backend API OIDC serves web/desktop users and on-demand API proxy traffic.
- Secondary ingest OIDC serves local scrape/list/rotation/enrichment jobs and GitHub Actions.

This protects the user-facing Backend API from batch jobs consuming the shared skills.sh OIDC budget. See [Ingest OIDC](docs/developer/ingest-oidc.md), [Scrape Pipeline](docs/developer/scrape-pipeline.md), and [Page-cache Ops](docs/developer/page-cache-ops.md).

## OpenAI Build Week

Skilltopia is being submitted to [OpenAI Build Week](https://openai.com/build-week/).

Codex helped with implementation planning, codebase navigation, release-readiness tasks, documentation cleanup, security review follow-ups, and product polish. Key product and engineering decisions, including the MIT licensing posture, Coduo Studio ownership, upstream attribution, and Skilltopia trademark reservation, were made by the creators and then reflected in the repository with Codex assistance.

## Documentation

- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Developer Docs](docs/developer/README.md)
- [Architecture Guide](docs/developer/architecture-guide.md)
- [Design System](docs/design/DESIGN.md)
- [Release Notes and Process](docs/developer/releases.md)

## Repository Status

Skilltopia is preparing for its first public desktop release. The source is usable today, but public binaries, update signing, notarization, and Sponsors links are tracked in follow-up release tasks.

## License

[MIT](LICENSE.md). See [NOTICE.md](NOTICE.md) for attribution and trademark notes.
