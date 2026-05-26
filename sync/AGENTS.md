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
1. **Department values mismatch**: `Programs.ts` hardcodes `kids`/`signage` as department options, but `DEPARTMENTS` constant defines `children`/`signage`/`youth`. Other collections (Users, Devices) correctly use the constant.
2. **Sync agent path**: Root `package.json` `sync` script points to `sync-agent/sync-agent.js`; file is at `sync/sync-agent.js`. Script will fail as-is.
3. **Sync agent hardcoded placeholders**: `API_URL`, `DEVICE_ID`, `PLUG_IP` are placeholder values.
4. **Deployment domain**: nginx config uses `cms.yourchurch.org` — must be replaced before deploy.

## Current state
- **Player app is incomplete**: Missing `src/routes/`, `svelte.config.js`, `vite.config.ts`. Not yet runnable as a SvelteKit app.
- **All workspace dependencies are `"latest"`** — not pinned, no lockfile committed.
- **No tsconfig.json** in either workspace or at root.
- **No CI/CD** — no GitHub Actions or other pipeline configured.

## Deployment
- **Server**: `docker-compose up -d --build` (Postgres + Payload + Nginx on AWS Lightsail)
- **Client**: `pm2 start ecosystem.config.js` (player + sync agent on bare metal)
