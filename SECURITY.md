# Security Policy

## Reporting Vulnerabilities

Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.

Use GitHub private vulnerability reporting for this repository:

https://github.com/sahildave/skilltopia/security/advisories/new

Include the affected area, reproduction steps, potential impact, and any relevant logs or screenshots. Do not include live secrets in the report.

## Scope

Security-sensitive areas include:

- Desktop filesystem access and Tauri permissions
- Skill install and uninstall commands
- Backend API routes under `api/`
- Supabase, Qdrant, skills.sh, and AI provider integrations
- Release signing, updater metadata, and GitHub Actions secrets

## Secrets

- Never commit `.env*`, credentials, private keys, Infisical exports, Vercel env pulls, or Supabase service-role keys.
- Backend API secrets belong in Infisical and server-side hosting only.
- Desktop builds should receive only desktop-safe configuration.
- If a secret is exposed, rotate it before sharing details.

## Supported Versions

Skilltopia has not shipped a stable public release yet. Security fixes target the main branch until versioned public releases exist.
