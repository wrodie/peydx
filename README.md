# peydx

Multi-tenant church digital signage and classroom presentation system. Manage media, build programs, schedule content to screens, and play it back — online or offline.

## Features

- **Multi-department isolation** — Users are scoped to their departments. Admins see everything; volunteers only see their own media, programs, and schedules.
- **Folder organization** — Hierarchical folders (max 3 levels) for media and programs, scoped per department. Child folders inherit department from parent.
- **Block-based program builder** — Build programs from image, video, YouTube, audio, black screen, and segment blocks. Each slide has configurable advance mode (timed, on-end, manual) and transition (fade, cut, slide, zoom).
- **Bulk media upload** — Drag multiple images into a program; slides are auto-created with sensible defaults (5s timed, fade transition). Video and audio files auto-detect duration and set on-end advance.
- **Schedule management** — Assign programs to devices with day-of-week and time-window scheduling, overlap detection, and date range support.
- **Device management** — Two types of device types: hardware (API key auth, local sync agent) and browser (token auth, direct CMS connection).
- **Offline-first playback** — Hardware players sync media locally and run entirely offline. No internet required during playback.
- **Real-time updates** — WebSocket connections push schedule changes, remote control commands, and device status updates instantly.
- **Device mirroring** — A browser device can mirror a hardware device's display, showing the same slides in real time.
- **Video processing** — Automatic WebP conversion, 1080p size generation, video thumbnail extraction, and duration detection via ffmpeg/ffprobe.
- **Health dashboard** — Real-time device status (online/offline/stale) with heartbeat tracking and current program/slide display.
- **Web Base Remote Control** — Remote control each device via a web based panel.


## Monorepo Structure

| Path | Description |
|---|---|
| `apps/server/` | Payload CMS v3 backend — collections, hooks, WebSocket server, admin UI |
| `apps/player/` | React + Vite signage player — offline-first slide renderer |
| `packages/signage-core/` | Shared slide rendering engine (SlideEngine, MenuEngine, types) |
| `sync/` | Sync agent — Node.js cron worker + Express server + Socket.IO relay |
| `nginx/` | Reverse proxy config for Docker deployment |

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 16+ (for local server development)

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URI=postgres://user:password@localhost:5432/peydx
PAYLOAD_SECRET=your-secret-key
POSTGRES_USER=peydx
POSTGRES_PASSWORD=your-password
POSTGRES_DB=peydx
TIMEZONE=Melbourne/Australia
```

- `DATABASE_URI` — Postgres connection string
- `PAYLOAD_SECRET` — Payload CMS encryption secret
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — Docker Compose Postgres credentials
- `TIMEZONE` — IANA timezone for schedule evaluation (default: `UTC`)

### Development Commands

```bash
npm run dev:server      # Start Payload CMS dev server (port 3000)
npm run dev:player      # Start Vite dev server (port 5173)
npm run sync            # Start sync agent + Express server (port 5000)
```

### Testing

```bash
npm run test              # Run all tests
npm run test:core         # signage-core package tests
npm run test:player       # player app tests
npm run test:server       # server tests
npm run test:sync         # sync agent tests
```

### Build

```bash
npm run build:all         # Build server and player
```

### Client Deployment Options

The hardware player can be deployed in two ways:

- **Docker (recommended)**: `docker compose -f docker-compose.client.yaml up -d --build` — eliminates manual Node.js/PM2 setup, handles dependency installation and player build automatically
- **Manual / PM2**: `npm run sync` or `pm2 start ecosystem.config.js` — for development or when Docker is not available

See [DEPLOY_CLIENT.md](./DEPLOY_CLIENT.md) for complete setup instructions.

## Further Reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture, data flow, and component diagrams
- [DEPLOY_SERVER.md](./DEPLOY_SERVER.md) — Production server deployment (Docker + Cloudflare Tunnel)
- [DEPLOY_CLIENT.md](./DEPLOY_CLIENT.md) — Hardware player and browser device deployment