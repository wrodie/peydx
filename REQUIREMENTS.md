# System Architecture, Specifications & Requirements Document
## Multi-Tenant Church Digital Signage & Classroom Presentation System

This document serves as the comprehensive, unified structural single source of truth for building, maintaining, or refactoring the custom Church Digital Signage and Presentation platform. It merges the core architectural constraints with functional hardware and content specifications.

---

## 1. Executive Summary & Design Philosophy
The system is a decoupled, multi-tenant digital signage and presentation platform designed specifically for church environments. It allows multiple internal ministries (departments) to safely co-manage media assets, play loops, and hardware screens from a unified backend while ensuring specialized operational behavior at the venue layer.

### Key Constraints & Visual Requirements:
* **Resilience (Offline-First):** Local media players must function perfectly during complete internet outages. Classroom Mode must play 1080p video with 0% stutter, even if the building’s internet fails entirely.
* **Budget & Hardware Optimization:** Server infrastructure runs cost-effectively in the cloud (AWS Lightsail), while venue hardware supports a hybrid two-tier deployment model leveraging repurposed mini PCs and low-cost streaming devices. 
* **Data Isolation (DRY & Multi-Tenant):** Volunteers and staff are strictly isolated into their respective department views, but hardware displays can be securely shared across departments with automated scheduling overlap prevention.

---

## 2. Hardware Architecture Tiers
The system natively supports two distinct tiers of venue hardware depending on the operational criticality of the room:

### 2.1 Tier 1 Player: HP EliteDesk Mini PC (Classroom Mode)
* **Use Case:** Mission-critical offline lessons and classroom instructional teaching.
* **Hardware:** HP EliteDesk 800 G2 (or equivalent Intel Core i5 Mini PCs) with a 250GB SSD.
* **OS Environment:** Ubuntu Server (Headless) + Openbox Window Manager running directly on the host operating system (Bare Metal) to support direct GPU execution for complex browser-rendered media pipelines.
* **Frontend Execution:** React App running locally inside a Chromium Kiosk instance.
* **Local Infrastructure:** A background Node.js "Sync Agent" worker managed via PM2 that pulls data from the cloud, manages the bare-metal storage array, and provides local asset availability.
* **Power Management:** Target hardware BIOS configurations are modified to trigger **Auto-Power On** conditions upon intercepting AC power restoration. Software-based power control can also be triggered by the local sync agent via an **SLWF-08 WiFi Controller** to toggle TV power via software (e.g., On at 8:00 AM, Off at 5:00 PM).

### 2.2 Tier 2 Player: Google TV Streamer / Simple Browser (Signage Mode)
* **Use Case:** Affordable digital signage in hallways, foyers, and public areas.
* **Hardware:** Google TV Streamer devices or generic smart TV browsers.
* **Client App:** Fully Kiosk Browser (Android App) pointed directly to the hosted React player URL.
* **Caching Strategy:** Relies on service workers to handle on-the-fly client-side asset caching as content loops.
* **Power Management:** Native HDMI-CEC commands executed through the Android OS layer (configured via Fully Kiosk Browser settings) to handle automated display sleeping/waking.

---

## 3. Global Constants & Logical Partitioning (Multi-Tenancy)

To prevent structural drift, the system abstracts identity and routing labels into centralized configurations shared across layers.

### 3.1 Department Definitions
**File Path:** `src/constants/departments.ts`

```typescript
export const DEPARTMENTS = [
  { label: 'Childrens Ministry', value: 'children' },
  { label: 'Digital Signage', value: 'signage' },
  { label: 'Youth Ministry', value: 'youth' },
] as const;

export const DEPARTMENT_VALUES = DEPARTMENTS.map(d => d.value);

```

### 3.2 System Roles & Separation

* **`admin`:** Global "God-View" access. Can create/delete users, overwrite schedules, view all media across all departments, and configure raw device profiles.
* **`basic` / Departmental Volunteer (e.g., `Kids_Volunteer`, `Signage_Volunteer`):** Standard volunteer/staff access. Tied strictly to a single `department` attribute. They can only read, write, and manage content belonging to their assigned department.
* **UI Customization:** When a user logs in, the Media and Programs views are automatically pre-filtered by their Department tag. The administration sidebar navigation layout is logically partitioned into **"Classroom Tools"** and **"Public Signage"** headers.

---

## 4. Server Architecture & Data Model (Payload CMS Cloud Configuration)

The backend runs **Payload CMS v3** (MIT License) wrapped inside a multi-container Docker development environment deployed to an AWS Lightsail instance running Debian or Ubuntu. The underlying database is **PostgreSQL 16+** running within an isolated Docker container on the same instance with zero exposed public network routing listeners.

### 4.1 Nginx Reverse Proxy Service

An Nginx container intercepts external traffic on ports `80` and `443`, binding traffic down directly via inner proxy routing into Payload's core instance (`http://payload-cms:3000`). It manages SSL certificates dynamically by sharing persistent volumes mapping directly into a standard Let's Encrypt Certbot container.

### 4.2 Collections Configurations & Access Control Rules

#### A. Users Collection (`Users.ts`)

* **Slug:** `users`
* **Auth:** Enabled (JWT-based session authentication)
* **Fields:**
* `name`: Text, required.
* `role`: Select (`admin`, `basic`), default: `basic`, `saveToJWT: true`.
* `department`: Select mapped to `DEPARTMENTS`, `saveToJWT: true`. Hidden or conditionally read-only via the admin panel if `role === 'admin'`.


* **Access Control:**
* `read`: Admins see all user records. Basic users can only read their own user object (`id === user.id`).
* `create` / `delete`: Restricted strictly to `admin`.



#### B. Programs Collection (`Programs.ts`)

The centerpiece of user content workflows is the Program collection built using Payload Blocks, serving as an intuitive "Lesson Builder".

* **Slug:** `programs`
* **Fields:**
* `title`: String (e.g., "Easter Sunday Morning").
* `department`: Select mapped to `DEPARTMENTS`.
* `slides`: Blocks Field supporting layout sequences:
* **Image Block:** Relation to `media` + `duration` (number, required if advance mode is "Timed") + `transition` (Select: Fade, Cut, Slide, Zoom).
* **Video Block:** Relation to `media` + `advanceMode` (Select: "On End", "Manual", "Timed") + `duration` (number, required if "Timed") + `transition` (Select: Fade, Cut, Slide).


* **Bulk Upload Area:** A custom drag-and-drop workflow component within the program layout allowing users to drop 20+ images directly into the collection editor.



##### Slide Block Matrix & Advance Logic

| Feature | Image Block | Video Block |
| --- | --- | --- |
| **Media Asset Extensions** | `.jpg`, `.png`, `.webp` | `.mp4`, `.webm` |
| **Advance Mode Options** | `Manual (Click)`, `Timed` | `Manual (Click)`, `Timed`, `On End` |
| **Duration Parameter** | Required if mode is `"Timed"` | Required if mode is `"Timed"` |
| **Transition Types** | Fade, Cut, Slide, Zoom | Fade, Cut, Slide |

* **Functional Advance Logic Definitions:**
* `Manual (Click)`: The React player pauses on this slide indefinitely. It listens for keyboard events (`Spacebar`, `Right Arrow`) or an external presenter remote click before animating to the next slide.
* `Timed`: A JavaScript `setTimeout` triggers the transition automatically after the specified seconds elapse.
* `On End (Video Only)`: The player listens directly for the native HTML5 video `onEnded` event. This acts as a hands-free configuration for classroom presenters.



##### "Bulk Upload" Smart Defaults Logic

To optimize volunteer efficiency when dragging multiple images into a Program:

1. All imported images default to `advanceMode: "Timed"`.
2. All default durations are set to `5` seconds.
3. All default transitions are set to `Fade`.
4. Volunteers retain "Power User" override control to scan the sequence and change specific blocks (e.g., a "Memory Verse" slide) to `Manual (Click)` mode so a teacher can leave it up indefinitely.

#### C. Media Collection (`Media.ts`)
- **Slug:** `media`
- **Security Isolation:** Strict Zero-Public-Access. All files and database data require valid authentication.
- **Upload Properties:**
  - `staticDir`: `'media'`
  - `formatOptions`: Forces conversion to `webp` format at `80%` quality.
  - `imageSizes`: Automatically generates a `fullHD` dimension array (1920x1080).
- **Access Control:**
  - `read`: Restricted. Access is only granted if `user` is a logged-in account (Admin/Basic) OR if the request carries a valid `devices API-Key` header belonging to a registered hardware device.
  - `update`/`delete`: Restricted to `admin` OR matching department token (`user.department === media.department`).



#### D. Devices Collection (`Devices.ts`)

* **Slug:** `devices`
* **Fields:**
* `name`: Text, required (e.g., "Fellowship Hall TV").
 * *(Removed: `deviceId` field was a string unique identifier, deprecated in favor of numeric Payload `id` and API key auth.)*
* `departments`: Select mapped to `DEPARTMENTS` with `hasMany: true`, allowing cross-department shared ownership of physical displays.
* `schedule`: Array of scheduled blocks containing:
* `program`: Relationship linking to the `programs` collection. Filtered dynamically in the UI so basic users can only link programs matching their own department.
* `startTime`: Date-time picker restricted to 15-minute intervals.




* **Array Validation Logic:**
* The `schedule` field group contains a custom validation hook checking for duplicate `startTime` records. If an absolute schedule intersection or block collision is detected, saving throws a field-level UI blocker.


* **Access Control:**
* `read` / `update`: Granted if `user.role === 'admin'` OR if the authenticated user's department value is explicitly contained within the target device's `departments` array mapping (`device.departments.contains(user.department)`).



#### E. TV Status & Health Dashboard

A dedicated operational view tracking connected device states. The server records heartbeat pings to render a "Health Check" screen showing which screens across the venue fleet are online, offline, or currently executing a specific program timeline. Communication of update alerts is executed via streaming server connections (**WebSockets / Socket.io** or **Server-Sent Events**).

---

## 5. Client & Local Architecture (Tier 1 Hardware Setup)

```
+--------------------------------------------------------------+
|                     HP EliteDesk i5 Client                    |
|                                                              |
|   +-----------------------+      +-----------------------+   |
|   |       PM2 Engine      |      |   Bare-Metal SSD      |   |
|   |                       |      |                       |   |
|   |  [Process 1]          |      |  /local-media/        |   |
|   |  React App        |      |  (Holds offline image/|   |
|   |  (Port 5000)          |<====>|   video files)        |   |
|   |                       |      |           ^           |   |
|   |  [Process 2]          |      |           |           |   |
|   |  Sync Agent Loop      |------+-----------+           |   |
|   |  (Cron / Axios Fetch) |                              |   |
|   +-----------------------+                              |   |
+--------------------------------------------------------------+
                               |
                               v (Fetches Delta via JSON)
               +-------------------------------+
               |  Cloud Server (AWS Lightsail) |
               +-------------------------------+

```

#### F. Device Registration & Authentication Strategy

To enforce the Zero-Public-Access rule without requiring volunteers to manage passwords on local hardware, the system uses a **Pre-Shared API Key Registration Pattern**:

1. **Admin Creation:** An `admin` user logs into the Payload cloud dashboard and creates a new entry in the `Devices` collection (e.g., Name: "Youth Room TV", Device ID: `YOUTH-TV-01`).
2. **Key Generation:** Payload's native collection auth automatically generates a highly secure, unique **API Key** specifically for that device record.
3. **Provisioning:** The admin copies this generated key from the cloud dashboard.
4. **Client Setup:** During the physical installation of the HP i5 EliteDesk, the admin pastes this key into the local client's `.env` file (`DEVICE_API_KEY=...`).
5. **Operation:** The Sync Agent boots up, reads the key from the environment, and appends it to the `Authorization` header for all future background delta sync pulls.

### 5.1 Monorepo Folder Structure

```text
church-signage/
├── apps/
│   ├── server/             # Payload CMS (Docker Container Context)
│   └── player/             # React Digital Signage App (Native Node)
├── sync/                   # Background Synchronization Cron Worker
│   └── sync-agent.js       # Core Delta execution script
├── docker-compose.yml      # Cloud multi-container setup orchestration
├── ecosystem.config.js     # PM2 Bare-metal initialization profile for Client
└── package.json            # Workspace manager configuration

```

### 5.2 The Local Sync Agent Worker (`sync/sync-agent.js`)

- **Execution Strategy:** Runs as a continuous micro-service managed by PM2.
- **Authentication:** Must include the device's uniquely generated API Key in the HTTP headers for all cloud communication.
- **Sync Routine Logic:**
  1. Requests a delta payload from the server every X minutes using its unique API Key header.
  2. Parses the incoming schedules for the next rolling 24-hour cycle.
  3. Compares cloud targets against assets physically present inside the client directory: `./apps/player/public/local-media`.
  4. Downloads missing items via authenticated streaming buffers; purges stale historical media items missing from the upcoming 24-hour window.
  5. Writes out an updated, flat manifest file locally (`schedule.json`).


### 5.3 React Frontend Media Renderer (`SlideEngine.tsx`)

* **Runtime Mode:** Operates on port `5000` via automated production preview execution mode, reading data directly from the local manifest file to maintain perfect offline operation.
* **Layout Blueprint (The Blurred Backdrop UI):**
Images are styled utilizing twin layout stacks to perfectly fit arbitrary structural screen aspect ratios without hard cropping content:
* *Layer 1 (Background):* Set to full bleed viewport coverage (`object-fit: cover`), scaled up slightly to avoid edge leaking, heavily blurred (`blur(30px)`), and darkened down (`brightness(0.5)`).
* *Layer 2 (Foreground):* Layered over the background backdrop using a clear relative stack orientation, fitting its bounds safely inside the view window via containment configurations (`object-fit: contain`), layered safely with a soft contrast drop shadow.



```html
{#if slide.blockType === 'imageBlock'}
  {@const imageSrc = slide.image.sizes?.fullHD?.filename 
    ? `/local-media/${slide.image.sizes.fullHD.filename}` 
    : `/local-media/${slide.image.filename}`}

  <img src={imageSrc} class="backdrop" alt="" aria-hidden="true" />

  <img src={imageSrc} class="foreground" alt={slide.image.alt || 'Slide'} />
{#endif}

```

---

## 6. Client Deployment & Kiosk Wrapper Configuration

* **Process Management:** Local client software initialization is managed entirely by PM2 using `ecosystem.config.js`.
* **Browser Isolation Setup:** Systems initiate a local Chromium instance launched natively in Kiosk execution mode via system startup scripts:
```bash
chromium-browser --kiosk --incognito --noerrdialogs --disable-session-crashed-bubble http://localhost:5000

```



---

## 7. Authentication Architecture

The system enforces a strict zero-public-access boundary using a hybrid authentication strategy managed entirely within Payload CMS.

### 7.1 User Authentication (Human Operators)
- **Mechanism:** Native Payload email and password authentication.
- **Session Management:** Stateless JSON Web Tokens (JWT) stored in secure, HTTP-only cookies.
- **Token Payload:** The JWT must securely encrypt and carry the user's `role` and `department` fields.
- **Workflow:** Users must log in via the web UI to interact with any collections. Unauthenticated requests to administrative endpoints are rejected with a 401 Unauthorized status.

### 7.2 Device Authentication (Headless Hardware)
- **Mechanism:** Collection-level Pre-Shared API Keys.
- **Provisioning Workflow:**
  1. An Admin creates a hardware profile record in the cloud `Devices` collection.
  2. Payload auto-generates a unique, high-entropy API key bound strictly to that device ID.
  3. The Admin provisions the physical client by pasting this key into the local i5 `.env` file.
- **Execution:** The local Sync Agent must append this key to the HTTP header of every delta sync pull:
  `Authorization: devices API-Key [DEVICE_API_KEY]`
- **Security Scope:** Requests using a Device API Key bypass human login prompts but are rigidly restricted by read-only access control filters mapped exclusively to the departments assigned to that specific device ID.

### 7.3 JWT Custom Claims & Multi-Tenant Token Enrichment
- The Users collection configuration must explicitly override the default `auth.saveToJWT` properties to track the custom `role` and `department` parameters.
- Session authorization hooks evaluated across standard Collections (`Media`, `Programs`, `Devices`) must decode this JWT structure on every inbound server request.
- If the decoded token reveals a `role` value of `basic`, the collection's access control matrix must dynamically inject a query constraint forcing the database search engine to isolate records (`where department == jwt.department`).
- Non-admin human operators must be structurally prevented from modifying the `department` select control field inside the user profile interface via admin condition evaluation logic.
