# Client Deployment Guide

Two deployment tiers are supported: hardware players for mission-critical offline playback, and browser devices for lightweight signage.

## Hardware Requirements

### Tier 1 — Hardware Player (Offline-Capable)

| Component | Minimum |
|---|---|
| CPU | Intel Core i5 (or equivalent) |
| RAM | 4 GB |
| Storage | 250 GB SSD |
| OS | Ubuntu Server 22.04 LTS |
| Network | Ethernet recommended |

Hardware players run a local sync agent and Chromium kiosk for smooth 1080p video playback with CSS effects. The i5 requirement ensures consistent performance during video decoding and blur/transition rendering.

### Tier 2 — Browser Device

| Component | Minimum |
|---|---|
| Device | Any device with a modern browser (Chrome, Firefox, Safari) |
| Examples | Google TV Streamer, Fire TV Stick, Raspberry Pi, tablet, laptop |
| Network | Always-on internet required |

Browser devices connect directly to the CMS via WebSocket — no local software installation needed.

---

## Tier 1: Hardware Player Setup

### 1. Install Ubuntu Server

Install Ubuntu Server 22.04 LTS on the mini PC. During installation, enable OpenSSH server for remote access.

### 2. Install Openbox Window Manager

The player runs in a Chromium kiosk window managed by Openbox for minimal overhead and direct GPU access:

```bash
sudo apt-get update
sudo apt-get install -y xorg openbox
```

### 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Log out and back in for the group change to take effect.

### 4. Clone and Configure

```bash
git clone <your-repo-url> /opt/peydx
cd /opt/peydx
```

Create a `.env` file with the required variables:

```env
API_URL=https://cms.yourchurch.org/api
DEVICE_API_KEY=your-device-api-key
TIMEZONE=America/New_York
```

| Variable | Description |
|---|---|
| `API_URL` | Payload CMS API base URL (e.g. `https://cms.yourchurch.org/api`) |
| `DEVICE_API_KEY` | API key generated when you created the device record in the CMS admin panel |
| `TIMEZONE` | IANA timezone string for schedule evaluation (default: `UTC`) |

### 5. Start the Sync Agent

```bash
docker compose -f docker-compose.client.yaml up -d --build
```

This builds the player app and runs the sync agent in a Docker container. The sync agent will:
- Connect to the CMS via WebSocket for real-time schedule updates
- Fall back to polling every 60 seconds if WebSocket disconnects
- Download media files and write `schedule.json` atomically
- Serve the player on port 5000
- Send heartbeats to the CMS for the health dashboard

Media files are stored in a named Docker volume (`media_data`) that persists across container restarts and rebuilds.

Check that it's running:

```bash
docker compose -f docker-compose.client.yaml ps
docker compose -f docker-compose.client.yaml logs -f
```

### 6. Configure Kiosk Mode

Install Chromium:

```bash
sudo apt-get install -y chromium-browser
```

Create a kiosk startup script at `/opt/peydx/kiosk.sh`:

```bash
#!/bin/bash
xinit /usr/bin/chromium-browser \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --no-first-run \
  http://localhost:5000
```

Make it executable:

```bash
chmod +x /opt/peydx/kiosk.sh
```

### 7. Auto-Login and Auto-Start

1. Install the LightDM display manager:

```bash
sudo apt-get install -y lightdm
```

2. Create `/etc/lightdm/lightdm.conf`:

```ini
[SeatDefaults]
autologin-user=your-username
autologin-user-timeout=0
user-session=openbox
```

3. Create `~/.config/openbox/autostart`:

```bash
#!/bin/bash
/opt/peydx/kiosk.sh &
xdg-screensaver off &
xset -dpms &
xset s off &
```

Make it executable:

```bash
chmod +x ~/.config/openbox/autostart
```

4. Start the display manager:

```bash
sudo systemctl enable lightdm --now
```

The system should reboot into a full-screen Chromium kiosk showing the player at `http://localhost:5000`.

### 8. Verify

- The Chromium kiosk should appear full-screen on the display
- The player should load and show the current schedule or idle screen
- Check sync agent logs:

```bash
docker compose -f docker-compose.client.yaml logs sync-agent
```

---

## Tier 2: Browser Device Setup

No local software installation is required. Browser devices connect directly to the CMS.

### 1. Create a Browser Device in the CMS

1. Navigate to **Devices** in the admin panel.
2. Create a new device with **Device Type** set to `browser`.
3. Select the departments this device should display.
4. After creation, a `browserToken` is auto-generated and a **device URL** is displayed in the admin panel.

### 2. Point the Browser

On the target device (smart TV, tablet, etc.), open a browser and navigate to the device URL:

```
https://cms.yourchurch.org/player?id=<deviceId>&token=<browserToken>
```

The player will:
- Connect to the CMS via WebSocket for real-time schedule updates
- Fetch programs and media directly from the CMS
- Display the health status (online) on the device dashboard

### 3. Dedicated Browser (Optional)

For a kiosk-like experience on a smart TV or streaming device, install **Fully Kiosk Browser** (Android) or a similar locked-down browser and configure it to:
- Auto-start the device URL on boot
- Disable navigation bars and screen timeout
- Enable HDMI-CEC for automatic power management

### Mirroring a Hardware Device

A browser device can mirror a hardware player's display in real time. When creating or editing a browser device, set the **Controlling Device** field to the hardware device it should mirror. The browser device will then display the same slides, advance at the same time, and respond to remote control commands sent to the hardware device.

---

## Updating

### Hardware Player

```bash
cd /opt/peydx
git pull
docker compose -f docker-compose.client.yaml up -d --build
```

The `--build` flag rebuilds the player app with the latest code. The sync agent container is restarted automatically. No Chromium restart is needed — the player will pick up schedule changes from the sync agent.

### Browser Device

No action needed. Browser devices always fetch the latest data from the CMS.

---

## Troubleshooting

### Sync Agent Not Starting

```bash
docker compose -f docker-compose.client.yaml logs sync-agent
docker compose -f docker-compose.client.yaml up -d --force-recreate
```

Common issues:
- `API_URL` is unreachable — check network connectivity and DNS
- `DEVICE_API_KEY` is invalid — verify in the CMS admin panel under Devices
- `TIMEZONE` is not a valid IANA string — use values like `America/New_York`

### Player Shows Blank Screen

- Verify the sync agent is running: `docker compose -f docker-compose.client.yaml ps`
- Check sync agent logs for errors
- Check browser console at `http://localhost:5000` for errors (press F12 if keyboard is available)

### WebSocket Disconnected

- Check CMS server logs: `docker compose -f /opt/peydx/docker-compose.yaml logs payload-cms` (on the server)
- The sync agent will fall back to HTTP polling every 60 seconds if WebSocket disconnects
- Check the sync agent logs for connection errors

### Clear Media Cache

To start fresh with media (e.g., after changing the device or fixing sync issues):

```bash
docker compose -f docker-compose.client.yaml down -v
docker compose -f docker-compose.client.yaml up -d --build
```

The `-v` flag removes the media volume. All media will be re-downloaded on the next sync cycle.