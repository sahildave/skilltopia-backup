# Public Backend API readiness and privacy

**Milestone:** release  
**Depends on:** task-20  
**Priority:** 27 — easy to miss; required before public desktop downloads  
**Why this exists:** Not in the original packaging list, but desktop builds call the Backend API; a public binary without a stable public API (and a clear data story) will fail in the wild.

## Goal

Ensure anonymous/public desktop and web clients can use production Backend API safely, and document what data leaves the machine.

## Context

Vocabulary: **Backend API** owns secrets (skills.sh, Supabase, Qdrant, AI keys). Desktop must not embed those. Going OSS + shipping binaries implies strangers will hit your production API.

## Scope

- [ ] Confirm production Backend base URL is configured for release desktop builds (no localhost)
- [ ] Review CORS / auth model for public clients (no leaked service-role keys)
- [ ] Rate limits / abuse basics for search, detail, scrape-adjacent endpoints
- [ ] Short **Privacy** section in README (or `docs/privacy.md`): what is sent to Backend vs stays local (installed skills scan, etc.)
- [ ] Ensure Infisical/Vercel secrets stay server-side; audit client env for accidental Backend secrets
- [ ] Decide crash/analytics posture for v1 (off, opt-in, or documented third party)

## Out of scope

- Full GDPR program / DPA
- Real user auth (post-mvp task already exists)

## Done when

- A release desktop build against production API works on a machine with no Infisical
- README states what data is transmitted
- No Backend secrets in the public repo or client bundle
