# Security Policy

## Supported Versions

Skilltopia has not shipped a stable public release yet. Security fixes target the main branch until versioned public releases exist.

## Reporting a Vulnerability

Do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.

Use GitHub private vulnerability reporting for this repository:

https://github.com/sahildave/skilltopia/security/advisories/new

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fixes (if any)

## Security Measures

This app uses Tauri's security model:

- **Permissions**: Minimal system permissions via `capabilities/`
- **IPC**: Type-safe commands via tauri-specta
- **File Access**: Scoped to app directories by default
- **CSP**: Configured in Tauri configuration

## For Developers

### File Operations

```rust
// ✅ Validate paths - prevent traversal attacks
if filename.contains("..") {
    return Err("Invalid filename".into());
}

// ❌ Never trust raw user input for paths
std::fs::write(user_input, data)
```

### Secrets

- Never commit secrets to version control
- Use **Infisical** as the source of truth for Backend and local secrets (see [docs/developer/infisical.md](./developer/infisical.md))
- Sync Infisical → Vercel for the Backend API; inject locally with `infisical run`
- Do not put Backend secrets (`SUPABASE_*`, `QDRANT_*`, LLM keys) in the Tauri / desktop Infisical env
- Use GitHub Secrets only for CI/CD that Infisical does not cover (e.g. Tauri signing keys)
- If a secret is exposed, rotate it before sharing details.

### Dependency Audits

```bash
npm audit
cargo audit
```

## Resources

- [Tauri Security Guide](https://tauri.app/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
