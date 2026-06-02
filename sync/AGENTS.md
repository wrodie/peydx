# AGENTS.md

## Project overview
Church digital signage system — Payload CMS v3 backend, React + Vite offline-first player, Node.js sync agent.
Full architecture and data model spec: [`REQUIREMENTS.md`](./REQUIREMENTS.md)

## Monorepo layout
- `apps/server/` — Payload CMS v3 collections, blocks, hooks
- `apps/player/` — React + Vite signage player
- `packages/signage-core/` — Shared slide rendering engine (SlideEngine, types)
- `sync/sync-agent.js` — Background cron worker for local media sync
- `payload.config.ts` — **Repo root** (not inside apps/server/); imports from `apps/server/src/`
- `nginx/` — Reverse proxy + SSL termination config for deployment

## Dev commands
```bash
npm run dev:server      # Payload CMS dev server (Next.js on port 3000)
npm run dev:player      # Vite dev server on port 5000 (HMR)
npm run build:all       # Build both workspaces
npm run sync            # node sync/sync-agent.js (runs sync + Express server on port 5000)
```

No test runner, lint, or typecheck commands are configured.

## Required environment variables
No `.env.example` exists. Server requires:
- `DATABASE_URI` — Postgres connection string
- `PAYLOAD_SECRET` — Payload CMS secret

Docker Compose additionally requires: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

Sync agent requires:
- `API_URL` — Payload CMS API base URL (e.g. `http://localhost:3000/api`)
- `DEVICE_API_KEY` — API key generated for the device in CMS
- `PLUG_IP` (optional) — Smart plug IP for TV power management

## Auth header format
Payload v3 uses `Authorization: {collection-slug} API-Key {key}` (e.g. `Authorization: devices API-Key ...`).
The old Payload v2 format (`Authorization: PayloadAPIKey ...`) no longer works.

## Current state
- **Player app is complete**: React + Vite project, builds successfully to `apps/player/dist/`.
- **Sync agent is functional**: Resolves device ID, fetches approved schedules, downloads media, writes `schedule.json` atomically, serves player on port 5000.
- **All workspace dependencies are `"latest"`** — not pinned, no lockfile committed.

## Deployment
- **Server**: `docker-compose up -d --build` (Postgres + Payload + Nginx on AWS Lightsail)
- **Client**: `pm2 start ecosystem.config.js` (sync agent on bare metal, serves player + schedule + media)

## Known decisions & trade-offs

1. **Media list view**: Uses Payload's default table view (bulk upload, search, sort, pagination all work). Folders (`payload-folders`) were evaluated but dropped — browse-by-folder view lacks bulk upload and media-picker (ListDrawer) doesn't respect folder view. Organization is handled via `department` field + `listSearchableFields: ['name', 'filename']`.
2. **autoCreateSlides hook**: Program bulk media → slide auto-creation runs as a `beforeChange` hook. Must pass `req` through to `payload.update()` to share the parent create transaction (prevents "Not Found" error from uncommitted transaction).
3. **Media name auto-fill**: `beforeChange` hook sets `name` from `req.file.name` (ext-stripped) if left blank. Field is not required — UX is "type a name or leave blank to use filename".
4. **No migration strategy**: Dev database is dropped & recreated for schema changes. No production data exists yet.
5. **Schedule access for devices**: Device-authenticated requests bypass department filtering on the Schedule collection — the query's `where[devices][contains]` filter already restricts results to the device's own schedules.
6. **Devices access for self-read**: Device-authenticated requests can read their own record via `{ id: { equals: user.id } }`. The `deviceId` field was removed — the numeric Payload `id` is the sole identifier.
7. **Media download URLs**: Payload v3 serves files at `/api/media/file/<filename>` (not `/api/media/<filename>`).
