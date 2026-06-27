# PeydX — Church Education & Presentation System: Administrator Guide

## Table of Contents

1. [System Overview](#system-overview)
2. [Navigation](#navigation)
3. [Dashboard](#dashboard)
4. [Managing Departments](#managing-departments)
5. [Managing Users](#managing-users)
6. [Managing Folders](#managing-folders)
7. [Managing Devices](#managing-devices)
8. [Media Management](#media-management)
9. [Programs](#programs)
10. [Schedules](#schedules)
11. [Integrations](#integrations)
12. [Settings](#settings)
13. [Remote Control](#remote-control)
14. [Health Dashboard](#health-dashboard)

---

## System Overview

PeydX is a church education and presentation system for managing classroom content, children's ministry lessons, and digital signage displayed on screens throughout your church campus. It consists of three main parts:

- **CMS Backend** — The web-based content management system where you upload media, create programs, schedule content, and monitor devices.
- **Players** — Hardware devices (sync agents) or browser screens that run your programs in classrooms, worship spaces, and lobby displays.
- **Sync Agent** — A background process that runs on hardware players to download media and schedules from the CMS.

### How Departments Work

Everything in the system is scoped by **departments**. A department represents a ministry or area (e.g., "Youth Ministry", "Worship Team", "Main Auditorium"). Each department has its own:

- **Folders** — Root media and programs folders are created automatically when a department is created.
- **Media** — Uploaded files belong to a department's folders.
- **Programs** — Slide programs belong to a department's folders.
- **Schedules** — The department is automatically inferred from the selected program.
- **Devices** — Devices are assigned to one or more departments.
- **Users** — Users can belong to multiple departments and see data from all of them.

### User Roles

| Capability | Admin | Manager | Standard |
|---|---|---|---|
| See all departments' data | Yes | No — only their own departments | No — only their own departments |
| Create/edit/delete users | Yes | Create/edit/delete Standard users in their departments | No |
| Create/edit/delete devices | Yes | No | No |
| Create/edit/delete departments | Yes | No | No |
| Create/edit/delete folders | Yes | Create/edit/delete in their departments (folder must be empty) | Create/edit/delete in their departments (folder must be empty) |
| Upload and manage media | Yes | Within their departments | Within their departments |
| Create and edit programs | Yes | Within their departments | Within their departments |
| Delete programs | Yes | Within their departments | Within their departments |
| Create and edit schedules | Yes | Within their departments | Within their departments |
| Delete schedules | Yes | Within their departments | Within their departments |
| Access Settings and Integrations | Yes | No | No |
| Push software updates | Yes | No | No |
| Use Remote Control | Yes | Yes (devices in their departments) | Yes (devices in their departments) |

---

## Navigation

[Screenshot: Top navigation bar showing all icons and the Admin dropdown]

The top navigation bar provides quick access to all major sections:

| Icon | Label | Description |
|---|---|---|
| 🏠 | Home | Dashboard with device status, programs, and schedules |
| 🖼 | Media | Upload and manage media files |
| ▶ | Programs | Create and edit slide programs |
| 📅 | Schedules | Schedule programs on devices |
| 🖥 | Remote Control | Control what's playing on devices |
| 👤 | Account | Change your name, email, or password |

**Admin Dropdown** (visible to admins only, labeled "Admin" with a settings icon):

- Departments
- Folders
- Users
- Devices
- Integrations
- Settings

---

## Dashboard

[Screenshot: Dashboard view showing device cards, programs, and schedules]

The Dashboard is your home page. It shows three or four sections, all filtered by your departments.

### Devices Section

Displays cards for each device in your departments. Each card shows:

- **Status indicator**: Green dot = Online, Amber dot = Stale, Gray dot = Offline
- **Device name**
- **Current program** (or "--" if none)
- **Remote Control** button — links directly to the Remote Control page for that device

Status updates in real-time via WebSocket.

### Available Programs Section

Shows programs that have an active availability window (availableFrom is past or absent, and availableUntil is future or absent). Programs with no availability dates set at all are excluded.

Each card shows:
- Thumbnail (first slide's image, video thumbnail, or icon)
- Title
- Slide count (with loop badge if looping)
- Links to the program edit page

### Upcoming Programs Section

Only shown when there are programs becoming available within the next 2 days.

### Upcoming Automated Schedules Section

Shows upcoming schedules with:
- Program title
- Device names
- Day-of-week pills (Mon, Tue, etc.)
- Time range (start time — end time)

---

## Managing Departments

[Screenshot: Departments list and create/edit form]

Departments are the top-level organizational unit. They scope all content in the system.

### Creating a Department

1. Navigate to **Admin > Departments** in the top navigation.
2. Click **Create**.
3. Enter the **Name** (e.g., "Youth Ministry", "Worship Team").
4. Click **Save**.

When you create a department, the system automatically creates two root folders:
- A **media** root folder (for organizing uploaded files)
- A **programs** root folder (for organizing slide programs)

### Editing a Department

1. Click on a department in the list.
2. Update the name.
3. Click **Save**.

**Note:** Renaming a department does not rename its root folders — you may want to update those manually.

### Deleting a Department

Only admins can delete departments. Deleting a department that has associated users, folders, media, programs, schedules, or devices will fail — you must reassign or remove those items first.

---

## Managing Users

[Screenshot: Users list and create/edit form]

Only admins can create, edit, or delete user accounts.

### Creating a User

1. Navigate to **Admin > Users** in the top navigation.
2. Click **Create**.
3. Fill in the fields:
   - **Email** — The user's login email address
   - **Name** — The user's display name
   - **Password** — Set an initial password
   - **Role** — Choose Admin, Manager, or Standard
   - **Departments** — Select one or more departments (shown in sidebar, admin-only field)
4. Click **Save**.

### Understanding Roles

- **Admin** — Full access to everything. Can manage users, devices, departments, integrations, and settings. Can delete programs and schedules. Sees the Admin dropdown in navigation.
- **Manager** — Can create, edit, and delete Standard users within their departments. Can assign users to departments they belong to. Has all the content permissions of a Standard user. Cannot manage admins, managers, devices, departments, or settings.
- **Standard** — Can create, edit, and delete all content in their assigned departments (media, programs, schedules, folders). Cannot manage users or devices. Cannot access admin sections.

### Multi-Department Users

A user can be assigned to multiple departments. They will see and manage content from all their departments. For example, a user in both "Youth Ministry" and "Worship Team" can create programs that use media from either department.

### Editing a User

1. Click on a user in the list.
2. Update their name, role, or departments.
3. To reset their password, use the "Password" field in the sidebar.
4. Click **Save**.

---

## Managing Folders

[Screenshot: Folder tree sidebar on the Media list view]

Folders provide hierarchical organization for Media and Programs, scoped per department. Each folder is either a **media** folder or a **programs** folder.

### Folder Tree

- The folder tree appears as a sidebar on the **Media** and **Programs** list views.
- **"All Media"** / **"All Programs"** — shows all items across your departments (admin only for non-scoped view)
- **"Unfiled"** — shows items not assigned to any folder
- Expand/collapse arrows on folders with children
- The selected folder filters the list

### Creating Folders

1. In the folder sidebar, click the **+ New Folder** button, or click the inline **+** button next to a parent folder.
2. Enter the folder name.
3. Select the folder type (media or programs).
4. Choose a parent folder (optional — root folders have no parent).
5. Click **Save**.

**Rules:**
- Folders can be nested up to **3 levels deep** (root > level 1 > level 2).
- A folder's department is automatically inherited from its parent. Root folders are assigned to your first department.
- You cannot delete a folder that contains items or sub-folders.

### Moving Items Between Folders

1. Edit a media item or program.
2. In the sidebar, change the **Folder** field.
3. Click **Save**.

Note: The Folder field is hidden during creation (auto-assigned from your current folder selection) and visible during editing.

---

## Managing Devices

[Screenshot: Device list and edit form]

Devices represent the physical screens or browsers that display your content. Only admins can create or delete devices.

### Device Types

| Type | Description |
|---|---|
| **Hardware (sync agent)** | A physical device running the sync agent. Connects via API key for authentication. Downloads media and schedules locally. |
| **Browser (direct URL)** | A web browser pointed at a special URL. Connects directly to the CMS via a browser token. No local storage required. |

### Creating a Device

1. Navigate to **Admin > Devices**.
2. Click **Create**.
3. Fill in the fields:
   - **Name** — A descriptive name (e.g., "Lobby Screen", "Youth Room TV")
   - **Device Type** — Hardware or Browser
   - **Departments** — Select which departments this device belongs to. This controls which programs and schedules the device can access.
4. Configure optional settings:
   - **Controlling Device** — Set this to make the device mirror another device's program and slide position. Only one level of mirroring is allowed (no chains).
   - **Default Background** — Upload an image to display (centered on black) when no program is running.
   - **Hide Program List** — Check this to prevent the manual program selection menu from appearing on the device. The device will only play auto-scheduled programs.
5. Click **Save**.

### Browser Device URLs

For browser-type devices, the system auto-generates a **browser token**. When viewing a browser device, you'll see:

- **Browser Token** — A read-only UUID used for authentication.
- **Copy URL** / **Open in New Tab** — A custom URL in the format `/device/{id}?token={browserToken}` that you can share or bookmark.

### Device Status (Read-Only Sidebar)

| Field | Description |
|---|---|
| Last Heartbeat | Timestamp of the device's most recent check-in |
| Current Program | The program currently playing on the device |
| Current Slide Index | Which slide the device is showing |
| Status | Online, Offline, or Stale |
| Slide Status | Visual indicator showing current slide thumbnail |

Status values:
- **Online** — Device is actively checking in
- **Stale** — Device has checked in but may be behind
- **Offline** — Device has not checked in recently

### Mirroring (Controlling Device)

A device can be set to mirror another device. When configured:
- The mirror device plays the same program as the controlling device.
- The mirror device stays on the same slide as the controlling device.
- Only one level of mirroring is supported — you cannot chain mirrors (Device A controls Device B which controls Device C).
- When the controlling device's program or slide changes, the mirror updates in real-time via WebSocket.

### Pushing Updates

Admins can push software updates to devices:
1. Open a device's edit page.
2. In the sidebar, click **Push Update**.
3. The device will download and install the latest player version.

To push updates to all devices at once, use the **Settings** page (see [Settings](#settings)).

---

## Media Management

[Screenshot: Media list view with folder sidebar and thumbnail cells]

The Media collection stores all uploaded images, videos, and audio files used in slide programs.

### Media List View

The media list has a folder sidebar on the left and a table on the right. The table shows:

| Column | Description |
|---|---|
| Thumbnail + Name | A thumbnail preview and display name |
| Filesize | Human-readable file size (KB, MB, etc.) |
| Duration | Length in m:ss or h:mm:ss format (videos and audio) |
| Updated At | Last modification timestamp |

### Uploading Media

1. Navigate to **Media** in the top navigation.
2. Click **Create** (or drag files onto the list view).
3. Select a file from your computer. Supported types:
   - **Images** — Automatically converted to WebP format for efficiency
   - **Videos** — Duration is auto-extracted; thumbnails auto-generated
   - **Audio** — Duration is auto-extracted
4. Optional: Enter a **Display Name**. If left blank, the filename (without extension) is used automatically.
5. The **Folder** field is hidden on creation and auto-assigned based on your current folder selection in the sidebar.
6. Click **Save**.

After uploading:
- Images are converted to WebP (quality 80) and sized to fullHD (1920x1080, cropped) and thumbnail (400x300, contained).
- Videos get a thumbnail image auto-generated via ffmpeg.
- Video and audio duration is extracted via ffprobe.

### Editing Media

After saving, you can edit a media item to:
- Change the display name
- Change the folder assignment (the Folder field becomes visible on edit)
- Replace the file

When you save changes to media, the system automatically notifies all devices playing programs that use this media via WebSocket, so they can update their content.

### Deleting Media

When you delete a media item:
- The system scans all programs and removes references to the deleted media from slide blocks and bulk media arrays.
- All devices that were playing affected programs are notified to update their schedules.

This means you can safely delete media — the system cleans up program references automatically. However, programs that had this media in slides will have those slides become empty.

### Importing from YouTube

If the system is configured with `YOUTUBE_DOWNLOAD_ENABLED=true`, you'll see an **"Import from YouTube"** button above the media table:

1. Click **Import from YouTube**.
2. Paste a YouTube video URL or ID.
3. The video is downloaded, converted to MP4, and added as a new media item.

If YouTube import is not enabled, YouTube content can still be used via the YouTube slide type in programs (which embeds the video via iframe).

### Organizing Media with Folders

Use the folder sidebar to browse and create media folders. See [Managing Folders](#managing-folders) for details on folder organization.

---

## Programs

Programs are the core content entity — a sequence of slides that plays on devices. Think of a program as a presentation or playlist.

### Program List View

The programs list has a folder sidebar (programs-type folders) on the left and a table on the right. The table shows:

| Column | Description |
|---|---|
| Title | Program title |
| Updated At | Last modification timestamp |
| Created By | The user who created the program |

### Creating a Program

1. Navigate to **Programs** in the top navigation.
2. Click **Create**.
3. Enter a **Title** (required) — this appears in schedules, the dashboard, and on devices.
4. The **Folder** field is hidden on creation and auto-assigned based on your current folder selection.
5. Click **Save** to create the program, then add slides.

### Program Editor Layout

[Screenshot: Program editor showing Media Browser, Timeline, and Edit Drawer]

The program editor has three panels:

| Panel | Position | Purpose |
|---|---|---|
| **Media Browser** | Left (360px, collapsible) | Browse and drag media onto the timeline |
| **Program Timeline** | Center | View and reorder slides |
| **Slide Edit Drawer** | Right (360px, slides in from edge) | Edit individual slide properties |

### Adding Slides

Click **"+ Add Slide"** in the timeline header to choose a slide type:

| Slide Type | Icon | Description |
|---|---|---|
| Image Slide | 🖼 | Displays an image |
| Video Slide | 🎬 | Plays a video file |
| YouTube Slide | ▶️ | Embeds a YouTube video |
| Audio Slide | 🎵 | Plays audio with a speaker icon on screen |
| Black Screen | ◼ | Displays a solid black screen |
| Segment | 📁 | A container that groups slides with its own settings |

For all slide types except Black Screen, the Slide Edit Drawer opens automatically so you can configure the slide. Black Screen slides are added with default settings (Fade transition, Manual advance) and don't require further configuration.

### Slide Properties

Each slide has the following properties, configurable in the Edit Drawer:

| Property | Options | Description |
|---|---|---|
| **Transition** | Fade In, Instant Cut, Slide Left | How the slide appears on screen |
| **Advance Mode** | Timed, Manual, On End | When to move to the next slide |
| **Duration** | Number (seconds) | How long to display the slide (only for Timed mode, defaults to 5 seconds) |
| **Loop Media** | Checkbox | Whether to loop the video/audio/YouTube content |

**Advance Mode details:**
- **Timed (Automatic)** — The slide advances after the specified number of seconds.
- **Manual (Wait for Click)** — The slide stays until the operator advances it via Remote Control or the device keyboard.
- **On End (Play to Finish)** — Available for video, audio, and YouTube slides only. The slide advances when the media finishes playing.

### Slide Types in Detail

**Image Slide:**
- Select an image from the media library.
- Default advance: Manual, 5 seconds.
- Advance modes: Timed, Manual.

**Video Slide:**
- Select a video from the media library.
- Default advance: On End.
- Advance modes: Timed, Manual, On End.
- Optional loop toggle.

**YouTube Slide:**
- Enter a YouTube URL or video ID. Supported formats: full YouTube URLs (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`), or an 11-character video ID.
- The video title is auto-fetched and displayed.
- A thumbnail preview is shown.
- Default advance: On End.
- Advance modes: Timed, Manual, On End.
- Optional loop toggle.

**Audio Slide:**
- Select an audio file from the media library.
- Shows a speaker icon on the display screen.
- Default advance: On End.
- Advance modes: Timed, Manual, On End.
- Optional loop toggle.

**Black Screen:**
- No media selection needed.
- Default advance: Manual.
- Advance modes: Timed, Manual.
- Useful as a transition or end slide.

### Segments

[Screenshot: Segment container expanded with slides inside]

A Segment is a container that groups slides together with shared settings:

| Property | Description |
|---|---|
| **Segment Name** | Display name (editable inline by double-clicking) |
| **Background Audio** | Optional audio file that plays while the segment is active |
| **Loop** | When enabled, the segment's slides loop within the segment |
| **Exit Mode** | How the segment ends: "Follow slides" (normal sequencing), "Timer" (auto-exit after N minutes), or "Manual" (wait for operator) |
| **Duration** | Minutes until auto-exit (only shown when Exit Mode is "Timer") |

Segments cannot be nested — you cannot put a segment inside another segment.

### Drag-and-Drop

**From the Media Browser:**
1. Open the Media Browser panel (click the expand button if collapsed).
2. Browse folders and search for media.
3. Drag a media item onto the timeline — it automatically creates the correct slide type (image, video, or audio).
4. Drop onto a position to insert, or onto a segment to add inside it.

**Reordering slides:**
- Drag slides by the ≡ handle on the left side of each slide card.
- Drop them at the new position.

**Moving slides between segments:**
- Use the "Move to Segment" dropdown on each slide to move it to a different segment or to the top level.
- Alternatively, drag a slide from one segment into another.

### Bulk Media Upload

In the program sidebar, you'll find a **Bulk Media** upload zone:
1. Drop or select multiple files.
2. Each file is automatically converted to the appropriate slide type (image, video, or audio) and appended to the timeline.
3. The bulk media field is cleared after processing.

Bulk media can also be added inside segments, creating slides within that segment.

### Import Program

1. Click **"Import Program"** in the timeline header.
2. A modal opens showing other programs you can import from.
3. Search for a program by title.
4. Click on a program to import all its slides into your current program.
5. Slides are appended to the end of the timeline.

### Export PPTX

Click **"Export PPTX"** in the timeline header to download the program as a PowerPoint file. Only visible on saved programs.

### Program Sidebar Settings

When editing a program, the sidebar contains important settings:

| Field | Description |
|---|---|
| **Title** | Program name (required) |
| **Preview Link** | Opens a full-screen preview of the program |
| **Folder** | Which programs folder this belongs to (visible on edit only) |
| **Bulk Media** | Drop zone for auto-generating slides |
| **Loop** | When enabled, the program repeats from the beginning after the last slide |
| **Auto-black end slide** | Automatically adds a black screen (manual advance) at the end. Default: on. Only applies when Loop is off. |
| **Available From** | Date when the program becomes available for manual device selection |
| **Available Until** | Date when the program stops being available. Leave blank for indefinite. |
| **Available Devices** | Which devices can manually select this program from their menu |

**About the auto-black end slide:** When enabled and the program is not set to loop, the system automatically adds a black screen at the end with "Manual" advance mode. This prevents the program from unexpectedly cycling. The end slide is not persisted — it's generated on read and stripped on save.

### Deleting Programs

Only admins can delete programs. When a program is deleted, all devices that were using it (via schedules or manual selection) are notified via WebSocket.

---

## Schedules

Schedules determine when and on which devices programs play. There are two ways a program ends up on a device:

- **Scheduled (automatic)** — A schedule tells the device to start playing a program at a specific time. The program begins automatically — no one needs to be at the device.
- **Available (manual)** — By adding a device to a program's "Available Devices" list, the program appears in the device's on-screen menu. An operator can then select it using Remote Control or the device's keyboard.

When you create a schedule, the program will **automatically begin playing** on the selected devices at the scheduled time.

### Creating a Schedule

1. Navigate to **Schedules** in the top navigation.
2. Click **Create**.
3. Fill in the fields:
   - **Program** — Select from programs in your departments.
   - **Devices** — Select one or more devices in your departments.
   - **Start Time** — Date and time the program starts (15-minute intervals).
   - **End Time** — Date and time the program stops (defaults to 1 hour after start).
   - **Days of Week** — Select days for weekly recurrence, or leave empty for a one-off event.
   - **Until Date** — Optional end date for recurring schedules.
4. The **Department** field is hidden and auto-inferred from the selected program's folder.
5. Click **Save**.

### One-Off vs Recurring Schedules

**One-off event:**
- Leave the "Days of Week" field empty.
- The program plays once on the specified start date and time.

**Weekly recurring:**
- Select one or more days of the week (Monday through Sunday).
- The program plays every week on those days at the specified time.
- The date portion of "Start Time" is ignored — only the time-of-day matters.
- Optionally set an "Until Date" to end the recurrence on a specific date (e.g., for seasonal content).

### Overlap Detection

The system automatically prevents scheduling conflicts. When you save a schedule, it checks every selected device for overlapping time windows with existing schedules. If a conflict is found, you'll see an error:

> "This entry overlaps with an existing schedule on one of the selected devices."

To resolve this:
- Adjust the start/end times.
- Change the days of the week.
- Select different devices.

### Deleting Schedules

Admins and managers can delete schedules. Standard users can create and edit as well.

When a schedule is created, updated, or deleted, all affected devices are notified via WebSocket in real-time.

---

## Integrations

Integrations are API key credentials for external systems (e.g., Home Assistant, custom scripts) that need to interact with the PeydX API.

### Creating an Integration

1. Navigate to **Admin > Integrations**.
2. Click **Create**.
3. Fill in:
   - **Name** — Descriptive name (e.g., "Home Assistant", "Monitoring Script")
   - **Expires At** — When the API key expires
   - **Departments** — Optional. Restricts the key's access to specific departments. Leave empty for access to all departments.
4. Click **Save**.
5. Copy the generated API key — it will only be shown once.

### Using an API Key

Auth header format: `Authorization: integrations API-Key <key>`

Example:
```
Authorization: integrations API-Key eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

If departments are set on the integration, API calls will be scoped to only those departments. If no departments are set, the key has access to all departments' data.

---

## Settings

[Screenshot: Settings page with version info and update buttons]

The Settings page (in the Admin dropdown) is admin-only and manages deployment versioning.

| Field | Description |
|---|---|
| **Client Version** | The current version of the player software |

### Deploying Updates

- **Deploy [version]** — Triggers a server self-update. A reconnection overlay appears during the update.
- **Push [version] to All Devices** — Sends the current client version to all connected devices, triggering them to update.

To push an update to a single device, use the Update button on the device's edit page (see [Managing Devices](#managing-devices)).

---

## Remote Control

[Screenshot: Remote Control view with device selector, status badge, playback controls, and slide strip]

Remote Control lets you take manual control of what's playing on any device in your departments.

### Accessing Remote Control

- Click **Remote Control** in the top navigation, or
- From the Dashboard, click the "Remote Control" button on a device card.

### Selecting a Device

Use the device dropdown to select a device. You can also arrive with a device pre-selected via the Dashboard link (`?device={id}`).

### When a Program Is Playing

The display shows:
- **Status badge**: PLAYING (green), MENU (amber), IDLE/OFFLINE (gray)
- **Slide preview**: Current slide thumbnail or icon
- **Slide counter**: "Slide N of Total"

**Playback controls:**

| Button | Action |
|---|---|
| ◀ Prev | Go to previous slide |
| ⏸ Pause | Pause/resume the current slide |
| Next ▶ | Advance to next slide (or end program if on last slide) |
| End Program | Stop the program entirely (confirmation required) |

**Slide thumbnail strip:**
- A horizontal scrollable strip of all slides in the current program.
- The current slide has a blue border.
- Click any thumbnail to jump directly to that slide.

### When No Program Is Playing (Idle)

- A program selector dropdown shows:
  - Programs from the device's schedules
  - Programs that have this device listed in "Available Devices"
- Click **Load Program** to start it on the device.

### Real-Time Updates

Device status and slide position update in real-time via WebSocket. You don't need to refresh the page to see changes.

---

## Health Dashboard

A public page showing the status of all devices:

| Column | Description |
|---|---|
| Status | Online, Stale, or Offline |
| Device | Device name |
| Type | Hardware or Browser |
| Departments | Which departments the device belongs to |
| Current Program | What's currently playing |
| Slide | Current slide thumbnail |
| Last Heartbeat | Timestamp of last check-in |