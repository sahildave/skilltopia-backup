# Web app client (same Backend API)

**Milestone:** post-mvp  
**Post-MVP #:** 1  
**Epic note:** Separate from Skills Explorer MVP numbering — prioritize among other epics later.

## Goal

Ship a web client that uses the same **Backend API** as the desktop app (no secrets in the browser beyond public read).

## Context

MVP is **desktop-only**. Architecture (UI → Backend API) makes web a follow-up, not a rewrite. Hard parts: replace Tauri-only APIs (opener, fs, seed path).

## Scope

- [ ] Vite/web build hitting Backend API  
- [ ] Share query/hooks where possible  
- [ ] Handle missing Tauri plugins gracefully  

## Out of scope

- Duplicating enrichment pipeline in the browser
