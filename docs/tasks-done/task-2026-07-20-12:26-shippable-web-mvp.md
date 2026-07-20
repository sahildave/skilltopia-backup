# Shippable web MVP (acquisition surface)

**Milestone:** web-desktop  
**Depends on:** task-2, task-3  
**Absorbs:** former task-9; web half of old post-mvp-8 copy-command

## Goal

Polish the web app enough to ship for **user acquisition and quick search**: browser shell polish, Library “get the app” CTA, Install **copy command**.

## Scope

- [x] Polished browser shell (still not a fake desktop titlebar)
- [x] Library whole-screen: download/get-the-app messaging + link
- [x] Install / skill actions: copy install command via web `PlatformPort.install`
- [x] Dashboard + search work on production same-origin deploy
- [x] i18n strings for new copy

## Out of scope

- Desktop one-click install (task-5)
- Web account/auth (post-mvp)
- Monorepo

## Done when

- Web app is usable for browse/search without Tauri
- Copy-command path works on web; desktop install still owned by task-5
