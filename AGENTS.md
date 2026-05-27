# AGENTS.md

## Project overview
Church digital signage system — Payload CMS v3 backend, SvelteKit offline-first player, Node.js sync agent.
Full architecture and data model spec: [`REQUIREMENTS.md`](./REQUIREMENTS.md)

## Monorepo layout
- `apps/server/` — Payload CMS v3 collections, blocks, hooks
- `apps/player/` — SvelteKit signage player
- `sync/sync-agent.js` — Background cron worker for local media sync
- `payload.config.ts` — **Repo root** (not inside apps/server/); imports from `apps/server/src/`
- `nginx/` — Reverse proxy + SSL termination config for deployment

## Dev commands
```bash
npm run dev:server      # Payload CMS dev server
npm run dev:player      # SvelteKit player dev server
npm run build:all       # Build both workspaces
npm run sync            # ⚠ Script references old path `sync-agent/sync-agent.js`; actual file is `sync/sync-agent.js`
```

No test runner, lint, or typecheck commands are configured.

## Required environment variables
No `.env.example` exists. Server requires:
- `DATABASE_URI` — Postgres connection string
- `PAYLOAD_SECRET` — Payload CMS secret

Docker Compose additionally requires: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

## Code vs. REQUIREMENTS.md mismatches
1. **Sync agent path**: Root `package.json` `sync` script points to `sync-agent/sync-agent.js`; file is at `sync/sync-agent.js`. Script will fail as-is.
2. **Sync agent hardcoded placeholders**: `API_URL`, `DEVICE_ID`, `PLUG_IP` are placeholder values.
3. **Deployment domain**: nginx config uses `cms.yourchurch.org` — must be replaced before deploy.

## Current state
- **Player app is incomplete**: Missing `src/routes/`, `svelte.config.js`, `vite.config.ts`. Not yet runnable as a SvelteKit app.
- **All workspace dependencies are `"latest"`** — not pinned, no lockfile committed.

## Deployment
- **Server**: `docker-compose up -d --build` (Postgres + Payload + Nginx on AWS Lightsail)
- **Client**: `pm2 start ecosystem.config.js` (player + sync agent on bare metal)

## Known decisions & trade-offs

1. **Media list view**: Uses Payload's default table view (bulk upload, search, sort, pagination all work). Folders (`payload-folders`) were evaluated but dropped — browse-by-folder view lacks bulk upload and media-picker (ListDrawer) doesn't respect folder view. Organization is handled via `department` field + `listSearchableFields: ['name', 'filename']`.
2. **autoCreateSlides hook**: Program bulk media → slide auto-creation runs as an `afterChange` hook. Must pass `req` through to `payload.update()` to share the parent create transaction (prevents "Not Found" error from uncommitted transaction).
3. **Media name auto-fill**: `beforeChange` hook sets `name` from `req.file.name` (ext-stripped) if left blank. Field is not required — UX is "type a name or leave blank to use filename".
4. **No migration strategy**: Dev database is dropped & recreated for schema changes. No production data exists yet.
