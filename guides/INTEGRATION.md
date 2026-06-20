# External Integration API

REST and WebSocket API for third-party systems (e.g. Home Assistant) to control PeydX presentation and signage devices remotely.

## Overview

- **REST API** at `/api/external/v1/` — list devices, load programs, control playback
- **WebSocket API** at `/api/ws` — real-time device status and remote control
- **Auth** via API keys created in the `Integrations` CMS collection
- **Department scoping** — restrict keys to specific departments or leave global

## Creating an Integration Key

1. Log into the PeydX admin panel as an **admin** user
2. Navigate to **Admin > Integrations** in the sidebar
3. Click **Create New**
4. Fill in:
   - **Name** — descriptive label (e.g. "Home Assistant")
   - **Expires At** — date/time when the key stops working
   - **Departments** — leave empty for global access, or select specific departments
5. Click **Save**
6. After creation, click the **API Key** toggle in the auth sidebar to reveal the generated key
7. Copy the key — it cannot be retrieved later. Use the "Regenerate" button if you lose it.

## Authentication

All API requests must include the header:

```
Authorization: integrations API-Key <your-api-key>
```

Example:

```bash
curl -H "Authorization: integrations API-Key abc123..." \
  http://localhost:3000/api/external/v1/devices
```

### Expired Keys

If a key has passed its `expiresAt` date, the API returns `401`:

```json
{ "error": "API key has expired", "expiredAt": "2025-12-31T23:59:59.000Z" }
```

### Wrong Auth Type

If you try to access integration endpoints with a device key or user session, the API returns `403`:

```json
{ "error": "This endpoint requires an integration API key. Use Authorization: integrations API-Key <key>" }
```

## Department Scope

- **Empty departments** — the key can access all departments (global scope)
- **Departments selected** — the key can only access devices, programs, and schedules belonging to those departments

Attempting to access a device or program outside the key's scope returns `403`:

```json
{ "error": "Device not found or not accessible with this API key" }
```

## REST API

Base URL: `http://<host>:3000/api/external/v1`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/devices` | List all accessible devices with real-time status |
| GET | `/devices/:id` | Get device detail with current program |
| POST | `/devices/:id/program` | Load a program on a device |
| POST | `/devices/:id/advance` | Next slide |
| POST | `/devices/:id/previous` | Previous slide |
| POST | `/devices/:id/goto` | Go to slide index |
| POST | `/devices/:id/pause` | Pause/resume playback |
| POST | `/devices/:id/back` | Exit program / return to idle |
| GET | `/programs` | List accessible programs |
| GET | `/programs/:id` | Get program detail with slides |
| GET | `/schedules` | List active schedules (supports `?from=&to=` query params) |
| GET | `/docs` | OpenAPI specification (no auth) |
| GET | `/ws-docs` | AsyncAPI specification (no auth) |

### Response Shapes

**Device list** (`GET /devices`):

```json
{
  "devices": [
    {
      "id": 1,
      "name": "Sanctuary Left Screen",
      "deviceType": "hardware",
      "status": "online",
      "state": "playing",
      "currentProgram": { "id": 5, "title": "Sunday Morning Worship" },
      "currentSlideIndex": 3,
      "currentSlideThumbnail": "/api/media/file/thumbnail_abc123.jpg",
      "totalSlides": 12,
      "departments": [{ "id": 1, "name": "Worship" }],
      "lastHeartbeat": "2026-06-13T10:30:00.000Z"
    }
  ]
}
```

**Load program** (`POST /devices/:id/program`):

```json
// Request
{ "programId": 5 }

// Response
{ "success": true }
```

**Go to slide** (`POST /devices/:id/goto`):

```json
// Request
{ "slideIndex": 3 }

// Response
{ "success": true }
```

## WebSocket API

Connect to `/api/ws` with the integration API key in the Authorization header or as `auth.apiKey`.

### Connection

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', {
  path: '/api/ws',
  extraHeaders: {
    Authorization: 'integrations API-Key <your-key>'
  }
})

socket.on('connect', () => {
  console.log('Connected as integration')
})
```

### Events You Can Receive

| Event | Payload | Description |
|-------|---------|-------------|
| `device:status` | `{ id, slideIndex, programId, status }` | Device online/offline/slide changes |
| `device:stateChange` | `{ id, state, programId }` | Device state changed (idle/menu/playing) |
| `schedule:update` | `{}` | Schedule was modified |

### Events You Can Send

| Event | Payload | Description |
|-------|---------|-------------|
| `remote:advance` | `{ id }` | Next slide |
| `remote:previous` | `{ id }` | Previous slide |
| `remote:goto` | `{ id, slideIndex }` | Jump to slide index |
| `remote:program` | `{ id, programId }` | Load program |
| `remote:menu` | `{ id }` | Send to menu |
| `remote:back` | `{ id }` | Exit to idle |
| `remote:select` | `{ id }` | Select/enter |
| `remote:pause` | `{ id }` | Toggle pause |

### Restrictions

- Integration sockets **cannot** emit `device:heartbeat`, `device:slideChange`, or `device:stateChange` — these are reserved for hardware devices
- Remote commands are validated against department scope — if the integration's departments don't include the target device, the command is silently ignored

## Examples

### Home Assistant: Device Status Sensor

```yaml
# configuration.yaml
rest:
  - resource: http://peydx:3000/api/external/v1/devices
    headers:
      Authorization: integrations API-Key abc123...
    scan_interval: 30
    sensor:
      - name: "Sanctuary Screen Status"
        value_template: "{{ value_json.devices[0].status }}"
        json_attributes_path: "$.devices[0]"
        json_attributes:
          - state
          - currentSlideIndex
          - currentProgram
```

### Home Assistant: Load Program (REST Command)

```yaml
rest_command:
  load_worship_program:
    url: http://peydx:3000/api/external/v1/devices/1/program
    method: POST
    headers:
      Authorization: integrations API-Key abc123...
      Content-Type: application/json
    payload: '{"programId": 5}'
```

### Node.js: WebSocket Monitoring

```js
import { io } from 'socket.io-client'

const socket = io('http://peydx:3000', {
  path: '/api/ws',
  extraHeaders: {
    Authorization: 'integrations API-Key abc123...'
  }
})

socket.on('device:status', (data) => {
  console.log(`Device ${data.id}: ${data.status}`)
})

socket.on('device:stateChange', (data) => {
  console.log(`Device ${data.id} state: ${data.state}`)
})

socket.on('connect_error', (err) => {
  console.error('Connection failed:', err.message)
})
```

## API Reference

- **OpenAPI spec**: `GET /api/external/v1/docs` or `docs/openapi.yaml` in the repo
- **AsyncAPI spec**: `GET /api/external/v1/ws-docs` or `docs/asyncapi.yaml` in the repo
