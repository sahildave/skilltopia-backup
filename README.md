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

Useful commands:

```bash
npm run dev          # Web target
npm run dev:mock     # Web target with mocked platform/catalog adapters
npm run tauri:dev    # Desktop target
npm run check:all    # Full local quality gate
```

Shared UI code imports platform-specific behavior through `@platform` and catalog access through `@catalog`. Do not import `@tauri-apps/*` from shared React paths; keep desktop-only behavior behind the platform adapter.

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
