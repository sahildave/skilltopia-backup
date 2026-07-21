# Contributing

Thanks for helping improve Skilltopia. Keep contributions focused, easy to review, and aligned with the existing architecture.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Rust](https://rustup.rs/) (latest stable)
- Tauri prerequisites for your OS
- npm

### Setup

```bash
git clone https://github.com/sahildave/skills-explorer.git
cd skills-explorer
npm install
npm run dev
npm run check:all
```

Use npm only. This repository does not use pnpm or yarn.

## Running the App

```bash
npm run dev        # Web target for day-to-day React work
npm run dev:mock   # Web target with mocked platform/catalog adapters
npm run tauri:dev  # Desktop target with Tauri
```

Desktop development may require Infisical for desktop-safe local environment variables. Backend API secrets must stay server-side and must not be added to the Tauri app or committed to the repo.

## How to Contribute

### Issues

- Bug reports should include reproduction steps and expected behavior.
- Feature requests should explain the user workflow they support.
- Security issues must follow [SECURITY.md](../SECURITY.md).

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes following the guidelines below
4. Ensure checks pass: `npm run check:all`
5. Push and open a Pull Request

## Code Guidelines

### TypeScript/React

- Use TypeScript for all new code
- Follow existing component patterns
- See `docs/developer/` for architecture patterns

### Rust

- Use `cargo fmt` and `cargo clippy`
- Use `Result<T, String>` for Tauri commands
- See `docs/developer/rust-architecture.md`

## Quality Gates

All PRs must pass:

- TypeScript type checking
- ESLint and Prettier
- Rust formatting and clippy
- Tests

Run locally: `npm run check:all`

## Code Review

- Keep PRs focused and reasonably sized
- Write clear PR descriptions
- Respond to feedback promptly
- Update documentation as needed

## Legal

By contributing, you agree that your contributions will be licensed under the same license as the project.
