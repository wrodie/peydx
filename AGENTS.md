# AGENTS.md

## Project overview
Church education and presentation system with digital signage — Payload CMS v3
backend, React + Vite offline-first player, Node.js sync agent. Full architecture
and data model spec: [`guides/ARCHITECTURE.md`](./guides/ARCHITECTURE.md).

## Monorepo layout
- `apps/server/` — Payload CMS v3 collections, blocks, hooks, endpoints
  - `apps/server/src/payload.config.ts` — Payload config (a 1-line re-export
    shim lives at `apps/server/payload.config.ts`; **not** at repo root)
  - `apps/server/server.ts` — Next.js + Socket.IO bootstrap: connection
    handlers, room joining (`department:{id}`, `device:{id}`, `integration:{id}`),
    heartbeat, remote-control emit gates
- `apps/player/` — React + Vite signage player
- `packages/signage-core/` — Shared slide rendering engine (SlideEngine, types)
- `sync/` — `sync-agent.js` (cron worker) + `ecosystem.config.js` (PM2)
- `scripts/` — `bootstrap-client.sh`, `deploy.sh`, `server-manager.py` (Flask
  update-listener), `peydx-logrotate.conf`
- `nginx/` — Reverse proxy + SSL termination
- `guides/` — ARCHITECTURE.md, DEPLOY_SERVER.md, DEPLOY_CLIENT.md, INTEGRATION.md
- `docs/` — `openapi.yaml`, `asyncapi.yaml`
- `.github/workflows/ci.yml` — CI (Test + Build)

## Dev commands
```bash
npm run dev:server   # Payload CMS dev server (Next.js on port 3000)
npm run dev:player   # Vite dev server on port 5000 (HMR)
npm run build:all    # Build both workspaces
npm run sync         # sync-agent.js (sync + Express server on port 5000)
```
Test runner: `npm test` (all), `npm run test:server` (vitest), `test:core`,
`test:player`, `test:sync`. `test:ci` exists for CI. No lint or typecheck
commands are configured.

## Environment variables
No `.env.example`. Server requires:
- `DATABASE_URI` — Postgres connection string
- `PAYLOAD_SECRET` — Payload CMS secret

Server optional:
- `TIMEZONE` — default timezone (used in payload config, schedule hooks, sync-agent)
- `CORS_ORIGIN` — cross-origin WebSocket (required in production)
- `YOUTUBE_DOWNLOAD_ENABLED` — `true` enables YouTube → MP4 via `yt-dlp` + `deno`
  (both in Docker image). Disabled → YouTube blocks use the iframe embed player.
- `SERVER_MANAGER_URL` / `SERVER_MANAGER_TOKEN` — used by deploy / pushUpdate /
  deployStatus / serverStatus endpoints

Docker Compose additionally requires: `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB`. Client compose uses `CLOUDFLARE_TUNNEL_TOKEN`, `REGISTRY_URL`,
`LOCAL_DIR`, `SCHEDULE_PATH`, `UPDATE_LISTENER_URL`, `CLIENT_VERSION`.

Sync agent requires:
- `API_URL` — Payload CMS API base URL (e.g. `http://localhost:3000/api`)
- `DEVICE_API_KEY` — API key generated for the device in CMS

## Auth header format
Payload v3 uses `Authorization: {collection-slug} API-Key {key}`
(e.g. `Authorization: devices API-Key ...`).

Auth modes on `Devices`:
- Hardware devices: API-Key auth (above)
- Browser devices: `browser-token` auth strategy + `deviceType` field
  (`browser` vs `hardware`); connect directly to CMS over WebSocket

## Deployment
- **Server**: `docker compose up -d --build` (Postgres + Payload + Nginx
  ). Optional Cloudflare Tunnel via `cloudflared` service profile.
- **Client (recommended)**: `docker compose -f docker-compose.client.yaml up -d`
  (sync-agent as Docker image pulling from registry)
- **Client (manual/dev fallback)**: `pm2 start ecosystem.config.js`

## Current state
- Player app is complete (React + Vite; builds to `apps/player/dist/`).
- Sync agent is functional: resolves device ID, fetches device-assigned
  schedules filtered by time window + day-of-week, downloads media, writes
  `schedule.json` atomically (`tmp` + `renameSync`), serves player on port 5000.
- `package-lock.json` is committed; sub-workspace deps use caret ranges.

## Known decisions & trade-offs

1. **autoCreateSlides hook** (`apps/server/src/hooks/autoCreateSlides.ts`):
   Program bulk media → slide auto-creation runs as `beforeChange` and mutates
   `data.slides` in place (no `payload.update()` call). `req` is passed only to
   `req.payload.findByID` / `req.payload.logger`.
2. **Migration strategy**: System is in production — DB cannot be dropped.
   Migrations must be non-destructive and backwards-compatible. Use
   `npx payload migrate:create` to generate a diff, then review/edit the SQL
   (no recreating tables, no dropping data; for enums use
   `ALTER TYPE ... ADD VALUE`). Apply via `npx payload migrate`. Existing
   migrations in `apps/server/src/migrations/`. **Every collection/field change
   must ship with a migration** — adding a field to Payload config alone won't
   create the column.
3. **Multi-department users**: `Users.department` was a single relationship;
   now `departments` hasMany, saved to JWT (`['role', 'departments']`). All
   access controls use
   `const deptIds = (user.departments || []).map((d) => typeof d === 'object' ? d.id : d)`
   then `{ department: { in: deptIds } }`. Schedule department is inferred
   from the program's `folder.department`. Default for folder/media/program
   creation without a parent folder = first department in the user's list.
   WebSocket rooms follow the same pattern. See item 6 for Folders.
4. **PPTX import**: `POST /api/import-pptx`
   (`apps/server/src/endpoints/mediaImportPptx.ts`) parses `.pptx` via
   `apps/server/src/utilities/pptxImporter.ts` (pure, no Payload deps; needs
   `jszip` + `fast-xml-parser`). Extracts full-screen images/videos/audios,
   imports `media`, creates a `programs` record; across-slides audio
   (`numSld > 1`) creates a `segmentBlock` with `backgroundAudio`. EMF/WMF/WMV
   are skipped with warnings. Files >90 MB are auto-split client-side
   (`ImportPptxButton.tsx`; 80 MB chunks) → `POST /api/import-pptx-chunk`;
   chunks reassemble on the final chunk; `DELETE /api/import-pptx-chunk` aborts.
   Stale temp dirs (>1 h) cleaned lazily on each chunk request.
5. **Schedule priority (overlap resolution)**: `Schedule.priority` select
   (`normal`/`high`/`override`, default `normal`). Numeric map `normal=0,
   high=10, override=20` lives in `PRIORITY_MAP` in `sync/schedule-utils.ts`.
   Overlap detection is enforced **within the same priority level** only;
   different-priority schedules may freely overlap. Player/sync-agent group by
   priority desc, pick from highest group; within a group pick latest startTime.
   Only admins set `override`. Any change to this field must ship a migration.
6. **PDF import**: `POST /api/import-pdf`
   (`apps/server/src/endpoints/mediaImportPdf.ts`) parses `.pdf` via
   `apps/server/src/utilities/pdfImporter.ts` (shells out to `pdfinfo` +
   `pdftoppm` from poppler-utils, installed in the server Docker image). Each
   page is rendered to a 1920px-wide PNG and imported as `media`; one
   `imageBlock` slide per page (`advanceMode: manual`, `transition: fade`), then
   a `programs` record is created (title = file name). Text/shapes are flattened
   into the page image — not editable in PeydX. Reuses the shared chunked-upload
   endpoints via `importShared.ts` (`createChunkedEndpoints`): files >90 MB are
   auto-split client-side (`ImportPdfButton.tsx`; 80 MB chunks) →
   `POST /api/import-pdf-chunk`; `DELETE /api/import-pdf-chunk` aborts.

(Folders, media name auto-fill, device self-read, media download URLs, and the
schedule device-access pattern are routine behavior enforced by hooks/tests —
see `apps/server/src/__tests__/unit/hooks/` and `sync/__tests__/`. Not
repeated here.)

## Testing discipline

1. **Every bug-fix commit must include a test** that fails before the fix and
   passes after, in the matching `__tests__/` directory.
2. **`npm test` must be green before any fix commit.** Bring up Postgres via
   `docker compose -f docker-compose.yaml -f docker-compose.test.yml up -d
   payload-db` (the test compose is **volume overrides only** — it does not
   define services; both files are required).
3. **High-regression areas must update the matching test files:**
   - `SlideEngine.tsx` timing model →
     `packages/signage-core/src/__tests__/SlideEngine.test.tsx`,
     `SlideEngine.segments.test.tsx`
    - `PlayerController.tsx` state transitions, manual-kill, or
      content-update-in-place →
      `packages/signage-core/src/__tests__/PlayerController.test.tsx`
      (content-update tests are under `content updates during playback`)`
   - Folder default assignment / department inheritance →
     `apps/server/src/__tests__/unit/hooks/mediaFolderAutoAssign.test.ts`,
     `folderBeforeChange.test.ts`
   - Schedule overlap priority resolution →
     `sync/__tests__/unit/schedule-filter.test.ts`,
     `apps/player/src/__tests__/schedule-resolver.test.ts`
     (the `normal=0/high=10/override=20` map must be asserted by tests)
   - WebSocket control-access emit gates → `apps/server/src/__tests__/.../verifyControlAccess.test.ts`
4. **CI is source of truth.** If `.github/workflows/ci.yml` is red on `main`,
   the build is broken regardless of local result. Fix forward, don't merge
   around it.
