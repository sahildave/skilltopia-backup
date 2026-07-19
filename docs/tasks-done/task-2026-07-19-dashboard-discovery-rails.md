# Dashboard discovery rails + cache / seed UX

**Epic:** Skills Explorer MVP (24h)  
**Milestone:** mvp  
**Depends on:** task-1; pairs with task-8 for first-run seed

## Goal

Discovery dashboard for desktop:

- **Top Installed** → skills.sh view `all-time`  
- **Trending** → `trending`  
- **Hot** → `hot`  

UX:

- Show **cached** skills immediately when present  
- Then refresh from Backend API and reconcile  
- First install uses **bundled seed** (see task-8)  
- If Backend API fails: keep cache/seed visible + **error banner**

## Scope

- [ ] Three discovery rails wired to the three API views  
- [ ] Stale-while-revalidate via TanStack Query (and/or persisted cache)  
- [ ] Error banner on fetch failure  
- [ ] Consume bundled seed on first run  

## Out of scope

- Hidden Gems / fastest growing / weekly growth (post-mvp)
- In-app install / copy command (post-mvp)
- Web client (post-mvp)

## Done when

- Cold open shows seed or cache; warm open feels instant; rails match API views
- Offline/API failure still shows last known skills + banner
