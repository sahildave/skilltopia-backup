# Contributing

Thanks for helping improve Skilltopia. Keep contributions focused, easy to review, and aligned with the existing architecture.

## Setup

```bash
git clone https://github.com/sahildave/skilltopia.git
cd skilltopia
npm install
npm run dev
```

Use npm only. This repository does not use pnpm or yarn.

## Running the App

```bash
npm run dev        # Web target for day-to-day React work
npm run dev:mock   # Web target with mocked platform/catalog adapters
npm run tauri:dev  # Desktop target with Tauri
```

Desktop development may require Infisical for desktop-safe local environment variables. Backend API secrets must stay server-side and must not be added to the Tauri app or committed to the repo.

## Quality Gate

Before opening a pull request, run:

```bash
npm run check:all
```

For smaller loops, use `npm run typecheck`, `npm run lint`, `npm run format:check`, and focused Vitest files.

## Pull Requests

- Keep PRs scoped to one behavior change or documentation update.
- Follow the patterns in [CODING_STANDARD.md](CODING_STANDARD.md) and [docs/developer](docs/developer/README.md).
- Add or update tests when changing business logic, adapters, commands, or data transforms.
- Update developer docs when introducing a new pattern or changing an existing one.
- Do not commit `.env*`, Infisical exports, local probe output, build artifacts, or generated credentials.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
