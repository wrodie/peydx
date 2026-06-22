# Architecture

System architecture for PeydX — a multi-tenant church education and classroom presentation platform with digital signage.

## System Overview

```mermaid
graph TB
        subgraph LocalServer["Local Server (Docker)"]
        PG["PostgreSQL 16"]
        CMS["Payload CMS v3<br/>(Next.js :3000)"]
        NX["Nginx<br/>(:80/:443)"]
        WS["Socket.IO Server<br/>/api/ws"]
        REG["Docker Registry<br/>:5050"]
        PG --- CMS
        CMS --- NX
        CMS --- WS
    end

    CF["Cloudflare Tunnel<br/>(External Access)"]
    CF --- NX

    subgraph AdminBrowsers["Admin Browsers"]
        AB1["Admin Dashboard"]
        AB2["User Dashboard"]
    end
    AB1 --- CF
    AB2 --- CF

    subgraph HardwarePlayer["Hardware Player (Mini PC)"]
        subgraph Docker["Docker Container"]
            SA["Sync Agent<br/>(Node.js)"]
            PX["Express Server<br/>(Static + Media)"]
            LWS["Local Socket.IO<br/>/ws"]
            SA --- PX
            SA --- LWS
        end
        PLAYER["Chromium Kiosk<br/>(Host OS)"]
        SA ---|WebSocket| WS
        SA ---|HTTP API| CMS
        PLAYER --- LWS
        PLAYER ---|schedule.json + media| PX
    end

    subgraph BrowserDevices["Browser Devices"]
        BD1["Smart TV / Tablet"]
        BD2["Mirrored Browser"]
    end
    BD1 ---|WebSocket + HTTP| CF
    BD2 ---|WebSocket + HTTP| CF

    WS -.->|schedule:update| SA
    WS -.->|remote:control| SA
    WS -.->|device:status| AB1
    SA -.->|heartbeat| WS
    SA -.->|slide:change| WS
```

## Components

### Server (`apps/server/`)

Payload CMS v3 running inside Next.js, serving the admin dashboard and REST API. Collections define the data model (Users, Departments, Media, Programs, Schedule, Devices, Folders). Hooks enforce access control, auto-create slides from bulk media, inherit folder departments, and emit WebSocket events on data changes.

### Player (`apps/player/`)

React + Vite single-page application. Detects its mode from URL parameters:
- **Hardware mode** (default) — connects to the local sync agent via WebSocket and fetches `schedule.json` for fully offline playback.
- **Browser mode** (`?id=X&token=Y`) — connects directly to the CMS via WebSocket and fetches programs from the API. Requires internet.
  - Both modes accept optional `&program=<id>&slide=<index>` to automatically load an available program at a specific slide on startup.
- **Version self-check** — on build, `dist/version.json` is written with the current git hash. The player polls this file every 5 minutes and reloads if the hash differs, picking up new code without manual refresh.

### Signage Core (`packages/signage-core/`)

Shared package containing the slide rendering engine:
- **SlideEngine** — renders the current slide with transitions (fade, cut, slide, zoom) and advance logic (timed, on-end, manual)
- **MenuEngine** — full-screen overlay for program selection
- **PlayerController** — manages player state (idle, menu, playing) and keyboard input
- **flattenProgram** — expands segments into flat slide arrays with context

### Sync Agent (`sync/sync-agent.js`)

Node.js background process, deployed as a Docker container (`docker-compose.client.yaml`) or via PM2. Handles:
- Resolves device identity from the CMS using its API key
- Fetches active schedules and available programs
- Downloads media files (preferring fullHD sizes) with conditional `If-Modified` requests
- Writes `schedule.json` atomically (write to `.tmp`, then rename)
- Serves the player app and media on port 5000 via Express
- Connects to CMS via Socket.IO for real-time updates; falls back to 60-second HTTP polling
- Sends heartbeats for the device health dashboard
- Forwards WebSocket events between the local player and the CMS

## Sync Data Flow

```mermaid
sequenceDiagram
    participant SA as Sync Agent
    participant CMS as Payload CMS
    participant DB as PostgreSQL
    participant PX as Express Server
    participant PL as Player App

    SA->>CMS: GET /devices (resolve device ID)
    CMS->>DB: Query device by API key
    DB-->>CMS: Device record
    CMS-->>SA: Device ID, name, departments

    SA->>CMS: GET /schedule (depth=3)
    CMS->>DB: Query schedules for device's departments
    DB-->>CMS: Schedule entries with programs + media
    CMS-->>SA: Full schedule data

    SA->>CMS: GET /programs?availableDevices=ID (depth=2)
    CMS-->>SA: Available programs with slide data

    loop For each media file
        SA->>CMS: GET /api/media/file/:filename<br/>(If-Modified-Since header)
        CMS-->>SA: 200 (download) or 304 (not modified)
    end

    SA->>SA: Filter active schedules (day, time, date range)
    SA->>PX: Write schedule.json atomically
    SA->>SA: Delete stale local media files

    PL->>PX: GET /schedule.json
    PX-->>PL: Schedule data
    PL->>PX: GET /local-media/:filename
    PX-->>PL: Media file

    SA->>CMS: POST /heartbeat (device status)
    CMS->>DB: Update device.lastHeartbeat + status
```

## WebSocket Event Flow

```mermaid
sequenceDiagram
    participant DEV as Hardware Device
    participant BR as Browser Device
    participant CMS as CMS Socket.IO
    participant ADM as Admin Dashboard

    Note over DEV,CMS: Connection & Auth
    DEV->>CMS: connect (Authorization: devices API-Key xxx)
    CMS-->>DEV: Authenticated, join rooms: device:{id}, department:{deptId}

    BR->>CMS: connect (token: browserToken)
    CMS-->>BR: Authenticated, join rooms: device:{id}, department:{deptId}

    ADM->>CMS: connect (cookie: JWT session)
    CMS-->>ADM: Authenticated, join rooms: department:{deptId}, admin

    Note over DEV,ADM: Heartbeat
    loop Every 30 seconds
        DEV->>CMS: device:heartbeat {status, currentProgram, currentSlideIndex}
        CMS->>ADM: device:status {deviceId, status, currentProgram, slideIndex}
    end

    Note over DEV,ADM: Remote Control
    ADM->>CMS: remote:program {id: deviceId, programId}
    CMS->>DEV: remote:program {program data}
    ADM->>CMS: remote:advance {id: deviceId}
    CMS->>DEV: remote:advance

    Note over DEV,ADM: Slide Changes
    DEV->>CMS: device:slideChange {slideIndex}
    CMS->>ADM: device:status {slideIndex}
    CMS->>BR: device:slideChange {slideIndex} (mirror devices)

    Note over DEV,ADM: Schedule Updates
    CMS->>DEV: schedule:update
    CMS->>BR: schedule:update (if affected)
    DEV->>CMS: Re-sync (full HTTP sync cycle)

    Note over DEV,ADM: Remote Client Updates
    ADM->>CMS: POST /api/push-update (update all)
    CMS->>DEV: remote:update { version }
    DEV->>CMS: Pull new image from registry, restart container
```

> **Browser devices** do not receive `remote:update`. Instead, the standalone player polls `/version.json` every 5 minutes and reloads when the git hash changes, picking up a new build without manual refresh. The `version.json` file is written during `vite build` by a Vite plugin that embeds `git rev-parse HEAD` into both the build output and the `__GIT_HASH__` compile-time constant.

## Authentication Flow

```mermaid
graph LR
    subgraph "Device Auth (API Key)"
        DA1["Hardware device<br/>sends Authorization header"] -->|"devices API-Key {key}"| DA2["Payload verifies key<br/>against Devices collection"]
    end

    subgraph "Browser Auth (Token)"
        BA1["Browser device<br/>sends ?id=X&token=Y"] -->|"Look up device by<br/>browserToken"| BA2["Cookie-based session<br/>with device context"]
    end

    subgraph "User Auth (JWT)"
        UA1["Admin / User<br/>logs in with email+password"] -->|"Payload default auth"| UA2["JWT cookie with<br/>role + departments"]
    end
```

All three auth methods converge on a Socket.IO middleware that validates identity and assigns rooms:

- **Device API key** → `device:{id}` room + `department:{deptId}` rooms
- **Browser token** → `device:{id}` room + `department:{deptId}` rooms
- **User JWT** → `department:{deptId}` rooms (+ `admin` room if admin role)

## Department Isolation

```mermaid
graph TD
    subgraph "Users Collection"
        U1["Admin User<br/>departments: [1, 2, 3]"]
        U2["Children's Dept User<br/>departments: [1]"]
        U3["Youth Dept User<br/>departments: [2]"]
    end

    subgraph "Departments Collection"
        D1["1: Children's Ministry"]
        D2["2: Youth Ministry"]
        
        D1 --> ROOTM["Root Media Folder"]
        D1 --> ROOTP["Root Programs Folder"]
        D2 --> ROOTM2["Root Media Folder"]
        D2 --> ROOTP2["Root Programs Folder"]
    end

    subgraph "Content (Filtered by Department)"
        M1["Media in Children's folder"]
        M2["Media in Youth folder"]
        P1["Program in Children's folder"]
        P2["Program in Youth folder"]
    end

    U1 -->|"sees all"| M1
    U1 -->|"sees all"| M2
    U2 -->|"sees only dept 1"| M1
    U2 -->|"sees only dept 1"| P1
    U3 -->|"sees only dept 2"| M2
    U3 -->|"sees only dept 2"| P2
```

Department filtering is enforced at the access control layer in every collection:

- **Users** have a `departments` hasMany relationship saved to their JWT
- **Media** and **Programs** belong to a `folder` which belongs to a `department`. Access control filters by `folder.department`
- **Schedule** entries infer their `department` from the selected program's folder. Admins see all; standard users see schedules in their departments; devices bypass department filter (the `devices[contains]` query already scopes results)
- **Folders** belong to a `department`. Child folders inherit department from their parent (non-overridable). Basic users see folders in their departments only
- **Devices** have `departments` hasMany. A device can display schedules from multiple departments. Basic users can manage devices in their own departments

The generic pattern used in access control hooks:

```typescript
const deptIds = (user.departments || []).map((d: any) =>
  typeof d === 'object' ? d.id : d
)
// Then filter: { 'folder.department': { in: deptIds } }
```

## Folder Organization

```mermaid
graph TD
    subgraph "Media Folders (type: media)"
        R1["Children's Root Folder<br/>dept: Children's"]
        R1 --> C1["Nursery<br/>dept: Children's (inherited)"]
        R1 --> C2["Elementary<br/>dept: Children's (inherited)"]
        C2 --> C3["Crafts<br/>dept: Children's (inherited)"]

        R2["Youth Root Folder<br/>dept: Youth"]
        R2 --> Y1["Worship<br/>dept: Youth (inherited)"]

        UF["Unfiled<br/>(no folder)"]
    end

    C3 -->|"Max 3 levels"| STOP["Cannot create<br/>deeper nesting"]
    R1 -->|"Department inherited<br/>from root folder"| NOTE["Child folders always<br/>inherit parent's department"]

    UF -->|"Unfiled media/programs<br/>appear in 'Unfiled' filter"| LIST["List View"]
    R1 -->|"Folder tree navigation"| LIST
```

Key rules:
- **Two separate trees**: `media` and `programs` folder types, each with their own root per department
- **Department inheritance**: When a department is created, root media and programs folders are auto-created. Child folders inherit department from their parent — it cannot be overridden
- **Max 3 levels deep**: Root (level 1) → Subfolder (level 2) → Sub-subfolder (level 3). Deeper nesting is blocked by a `beforeChange` hook
- **Auto-assignment**: When creating media or programs, the `folder` field is hidden and auto-assigned from the user's `current-folder` preference, falling back to the department's root folder
- **Delete protection**: Folders containing items or sub-folders cannot be deleted
- **Unfiled**: Items without a folder appear under the "Unfiled" filter in the list view

## Slide Engine Rendering Pipeline

```mermaid
graph LR
    subgraph "Program Structure"
        PROG["Program<br/>(from CMS or schedule.json)"]
        PROG --> S1["Segment: Worship"]
        S1 --> S1A["Image Slide<br/>advance: timed 5s"]
        S1 --> S1B["Video Slide<br/>advance: onEnd"]
        S1 --> S1C["YouTube Slide<br/>advance: onEnd"]
        S1 --> S1D["Audio Slide<br/>advance: onEnd"]
        PROG --> S2["Top-Level Slide"]
        S2 --> S2A["Image Slide<br/>advance: manual"]
        S2 --> S2B["Black Screen<br/>advance: timed 3s"]
    end

    subgraph "Flatten & Render"
        FP["flattenProgram()"]
        FP --> FLAT["Flat Slide Array<br/>with segmentContext"]
        FLAT --> SE["SlideEngine"]
        SE --> RENDER["Rendered Output<br/>+ transition animations<br/>+ auto-advance timers"]
    end

    PROG --> FP

    subgraph "Advance Modes"
        AM1["Timed: setTimeout(s)"]
        AM2["OnEnd: video.onEnded / audio.onEnded"]
        AM3["Manual: keyboard (Space/Arrow)"]
    end

    RENDER --> AM1
    RENDER --> AM2
    RENDER --> AM3
```

The rendering pipeline:

1. **Load program** — `PlayerController` resolves the active schedule entry and loads the program
2. **Flatten** — `flattenProgram()` expands segments into a flat `Slide[]` array. Each slide gets a `segmentContext` with background audio, loop settings, and position within the segment. `SegmentBoundary` entries track segment start/end indices
3. **Render** — `SlideEngine` renders the current slide with its configured transition. Handles:
   - **Image slides**: Dual-layer rendering (blurred backdrop + contained foreground)
   - **Video slides**: HTML5 video player with on-end detection
   - **YouTube slides**: Iframe API integration with auto-play and loop
   - **Audio slides**: HTML5 audio with on-end detection and optional background audio for segments
   - **Black screen slides**: Black overlay with timed or manual advance
4. **Advance** — When a slide ends (by timer, video end, or keyboard input), `SlideEngine` triggers the transition to the next slide. If the program ends and looping is disabled, an "End of program" overlay appears

## Deployment Architecture

```mermaid
graph TB
    subgraph "Local Network"
        subgraph "Server (Docker Compose)"
            PG["PostgreSQL 16<br/>:5432 (internal)"]
            CMS["Payload CMS<br/>:3000 (internal)"]
            NX["Nginx<br/>:80 / :443"]
            REG["Docker Registry<br/>:5050"]
            PG --- CMS
            CMS --- NX
        end

        subgraph "Hardware Player #1<br/>(e.g. Fellowship Hall)"
            subgraph "Docker Container"
                SA1["Sync Agent :5000"]
                V1["Media Volume<br/>/app/media"]
                SA1 --- V1
            end
            SA1 -->|"HTTP sync + WebSocket"| CMS
            PL1["Chromium Kiosk<br/>(Host OS)"] -->|"localhost:5000"| SA1
        end

        subgraph "Hardware Player #2<br/>(e.g. Youth Room)"
            subgraph "Docker Container"
                SA2["Sync Agent :5000"]
                V2["Media Volume<br/>/app/media"]
                SA2 --- V2
            end
            SA2 -->|"HTTP sync + WebSocket"| CMS
            PL2["Chromium Kiosk<br/>(Host OS)"] -->|"localhost:5000"| SA2
        end
    end

    CF["Cloudflare Tunnel"] --> NX

    subgraph "Remote Access"
        ADM["Admin / User<br/>Dashboard"]
        BD["Browser Device<br/>(Smart TV, Tablet)"]
    end

    ADM -->|"HTTPS"| CF
    BD -->|"HTTPS + WebSocket"| CF
```

- **Server**: Runs Payload CMS + PostgreSQL + Nginx in Docker on a local machine (Intel Core i5 minimum). All inter-container communication is internal. A named Docker volume (`media_data`) stores uploaded media.
- **Hardware players**: Mini PCs on the same local network. The sync agent runs in a Docker container (`docker compose -f docker-compose.client.yaml up -d`) pulling a pre-built image from the server's registry — no local build or git clone needed. Media is stored in a named Docker volume for persistence. The Chromium kiosk runs on the host OS for direct GPU access.
- **Cloudflare Tunnel**: Provides secure external access to the CMS admin panel and WebSocket connections without opening inbound ports. Handles TLS termination and DDoS protection.
 - **Browser devices**: Connect directly to the CMS through the Cloudflare Tunnel. Require internet but no local software. A browser device can mirror a hardware player's display by setting the `controllingDevice` field.
- **Admin access**: Users, managers, and admins access the CMS dashboard through the Cloudflare Tunnel for managing media, programs, and schedules.
- **Docker Registry**: A local registry on port 5050 stores pre-built sync-agent images. Client devices pull from this registry during remote updates.

## Remote Updates

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Server as Server (Docker)
    participant Reg as Registry :5050
    participant CMS as CMS Admin UI
    participant Manager as Server Manager (Host)
    participant Device as Sync Agent (Docker)
    participant Listener as Update Listener (Host)

    Dev->>Server: git tag v1.2.0 && git push --tags
    Admin->>CMS: Click "Deploy v1.2.0" in Settings
    CMS->>Manager: POST /deploy { version: "v1.2.0" }
    Manager->>Server: git fetch --tags && git checkout v1.2.0
    Manager->>Reg: Build & push sync-agent:v1.2.0 + :latest
    Manager->>Server: docker compose up -d --build
    Note over Server: CMS container restarts with v1.2.0

    Admin->>CMS: Click "Push v1.2.0 to All Devices"
    CMS->>Device: remote:update { version: "v1.2.0" }
    Device->>Listener: POST http://host.docker.internal:5555/update
    Note over Listener: Rewrite CLIENT_VERSION in .env
    Listener->>Reg: docker pull <registry>/sync-agent:v1.2.0
    Reg-->>Listener: Image layers
    Listener->>Listener: docker compose up -d
    Note over Device: Container restarts with v1.2.0
```

Since this is a monorepo, a single git tag represents both server and client code. The deploy action handles everything in one step:
1. Developer pushes a git tag (e.g. `v1.2.0`)
2. Admin clicks **Deploy v1.2.0** in the CMS Settings page — checks out the tag, builds the client image (pushed to local registry), and rebuilds the server
3. After the server restarts, admin clicks **Push v1.2.0 to All Devices** to update client devices