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

Server optional:
- `YOUTUBE_DOWNLOAD_ENABLED` — Set to `true` to enable YouTube → MP4 conversion via yt-dlp. Requires `yt-dlp` and `deno` binaries installed (both included in Docker image). When disabled, YouTube blocks use the iframe embed player.

Docker Compose additionally requires: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

Sync agent requires:
- `API_URL` — Payload CMS API base URL (e.g. `http://localhost:3000/api`)
- `DEVICE_API_KEY` — API key generated for the device in CMS

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

1. **Media list view**: Uses Payload's default table view (bulk upload, search, sort, pagination all work). Organization is handled via `listSearchableFields: ['name', 'filename']` plus a custom `Folders` collection (see item 2). The `department` field was removed from Media/Programs — department is now inherited from the folder's `department` field.
2. **Folders (custom tree structure)**: A custom `Folders` collection provides hierarchical organization for Media and Programs. Folders are scoped per-collection (`type` field: `media`/`programs`) and per-department. Max 3 levels deep. Non-admin users can create folders within their department. Delete is blocked if folder contains items or sub-folders. **Department inheritance**: When a child folder is created, its `department` is automatically inherited from the parent (cannot be overridden). The `folder` field on Media/Programs is hidden on create (auto-assigned from `current-folder` preference, falls back to department's root folder) and visible on edit. A `FolderTree` component renders a collapsible tree above the list table, with "All", "Unfiled", and clickable folder nodes that filter the list view. The folder tree uses `useListQuery.handleWhereChange` to update the list filter. Known limitation: the ListDrawer/media-picker in slide blocks does not include folder filtering yet.
3. **autoCreateSlides hook**: Program bulk media → slide auto-creation runs as a `beforeChange` hook. Must pass `req` through to `payload.update()` to share the parent create transaction (prevents "Not Found" error from uncommitted transaction).
4. **Media name auto-fill**: `beforeChange` hook sets `name` from `req.file.name` (ext-stripped) if left blank. Field is not required — UX is "type a name or leave blank to use filename".
5. **No migration strategy**: Dev database is dropped & recreated for schema changes. No production data exists yet. For the `department → departments` change, a manual SQL migration was run to create `users_rels` and copy data. See `apps/server/src/migrations/20260605_000000_departments_hasmany.ts`.
6. **Schedule access for devices**: Device-authenticated requests bypass department filtering on the Schedule collection — the query's `where[devices][contains]` filter already restricts results to the device's own schedules.
7. **Devices access for self-read**: Device-authenticated requests can read their own record via `{ id: { equals: user.id } }`. The `deviceId` field was removed — the numeric Payload `id` is the sole identifier.
8. **Media download URLs**: Payload v3 serves files at `/api/media/file/<filename>` (not `/api/media/<filename>`).
9. **Multi-department users**: The `department` field on Users was changed from a single `relationship` to a `departments` hasMany relationship. The field is saved to JWT (`saveToJWT: ['role', 'departments']`). All access controls use the pattern: `const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)` followed by `{ department: { in: deptIds } }`. Non-admin users with multiple departments see data from all their departments. Schedule departments are inferred from the selected program's `folder.department`. For folder/media/program creation without a parent folder, the first department in the user's list is used as the default. WebSocket rooms follow the same multi-department pattern — users join `department:{id}` rooms for each of their departments.
