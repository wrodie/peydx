# Client Deployment Guide

Two deployment tiers are supported: hardware players for mission-critical offline playback, and browser devices for lightweight signage.

## Hardware Requirements

### Tier 1 — Hardware Player (Offline-Capable)

| Component | Minimum |
|---|---|
| CPU | Intel Core i5 (or equivalent) |
| RAM | 4 GB |
| Storage | 128 GB |
| OS | Ubuntu Server 22.04 LTS (or equivalent) |
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

### 4. Create the Device in the CMS

Before bootstrapping, create the device record:

1. Navigate to **Devices** in the admin panel.
2. Create a new device with **Device Type** set to `hardware`.
3. Select the departments this device should display.
4. Copy the generated **API Key** — you'll need it in the next step.

### 5. Run the Bootstrap Script

**Note:** This script requires `sudo`. It configures Docker, downloads the required files from GitHub, creates `.env`, installs the update listener service, and starts the sync agent — all in one step.

```bash
curl -sL "https://raw.githubusercontent.com/wrodie/peydx/main/scripts/bootstrap-client.sh" \
  | sudo bash -s -- \
    --server-ip 192.168.1.100 \
    --api-key <your-device-api-key> \
    --timezone America/New_York
```

| Flag | Required | Description |
|---|---|---|
| `--server-ip` | Yes | Server's LAN IP address |
| `--api-key` | Yes | Device API key copied from the CMS in step 4 |
| `--timezone` | No | IANA timezone (default: `UTC`) |
| `--version` | No | Git tag to pull files from (default: auto-detects latest) |

What the bootstrap script does:
1. Adds `insecure-registries: ["<server-ip>:5050"]` to Docker config and restarts Docker
2. Creates `/opt/peydx/` and downloads `docker-compose.client.yaml`, `sync/update-listener.py`, `sync/update.sh`, `sync/update-listener.service`, and `scripts/peydx-logrotate.conf` from the latest release tag
3. Writes `/opt/peydx/.env` with `API_URL`, `DEVICE_API_KEY`, `TIMEZONE`, `REGISTRY_URL`, and `CLIENT_VERSION`
4. Installs and starts the `update-listener` systemd service
5. Pulls the sync-agent image from the registry and runs it

After the script completes, verify the sync agent is running:

```bash
sudo docker compose -f /opt/peydx/docker-compose.client.yaml ps
sudo docker compose -f /opt/peydx/docker-compose.client.yaml logs -f
```

The device should appear as "online" in the CMS dashboard within 30 seconds.

### 6. Configure Kiosk Mode

Install Chromium:

```bash
sudo apt-get install -y chromium-browser unclutter
```

Create a kiosk startup script at `/opt/peydx/kiosk.sh`:

```bash
#!/bin/bash
unclutter -idle 0 &
/usr/bin/chromium-browser \
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

## 9. Custom Key Mapping (Hardware Only)

If you're using a 2.4 GHz remote control or presentation clicker that sends non-standard key codes, you can remap the buttons by creating a `key-config.json` file alongside the sync agent.

### Default Mappings

| Action | Default Key Code(s) |
|---|---|
| Next slide | `Space` or `ArrowRight` |
| Previous slide | `ArrowLeft` |
| Open menu / Exit program | `KeyM` or `ContextMenu` |
| Navigate up | `ArrowUp` |
| Navigate down | `ArrowDown` |
| Select item | `Enter` |
| Go back / Close menu | `Escape` or `BrowserBack` |
| Pause / Play video | `KeyP` or `MediaPlayPause` |

### Example `key-config.json`

```json
{
  "keys": {
    "next": ["Space", "ArrowRight", "Numpad6"],
    "prev": ["ArrowLeft", "Numpad4"],
    "menu": ["KeyM", "ContextMenu"],
    "up": "ArrowUp",
    "down": "ArrowDown",
    "enter": "Enter",
    "exit": ["Escape", "BrowserBack"],
    "pause": ["KeyP", "MediaPlayPause"]
  }
}
```

Each value can be a single string or an array of strings. Use an array when you want multiple keys to trigger the same action.

### Finding Key Codes

Open the player in a browser, press F12 to open DevTools, and run this in the Console:

```js
window.addEventListener('keydown', e => console.log(e.code))
```

Press each button on your remote — the console will print the `e.code` value for each one. Use those values in your `key-config.json`.

### Placement

Place `key-config.json` in the sync agent's working directory. On a Docker-based deployment, mount it as a volume in `docker-compose.client.yaml`:

```yaml
volumes:
  - ./key-config.json:/app/key-config.json
```

Or copy it into a running container:

```bash
docker cp key-config.json peydx-sync-agent:/app/key-config.json
```

The sync agent picks up the file on the next HTTP request — no restart needed.

**Browser devices are not affected** — they use the built-in defaults and ignore `key-config.json`.

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
http://192.168.1.100/player?id=<deviceId>&token=<browserToken>
```

Optional URL parameters:
- `program=<id>` — Load a specific program on startup (must be in the device's schedule or available programs list)
- `slide=<index>` — Start at the given slide index (defaults to 0)

Example with all params:

```
http://192.168.1.100/player?id=<deviceId>&token=<browserToken>&program=5&slide=0
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


## Remote Updates

Client updates are triggered remotely from the CMS admin panel. No manual access to the client device is needed after initial setup.

### How It Works

1. Code is pushed and a git tag is created (`git tag v1.2.0 && git push --tags`).
2. An admin clicks **Deploy v1.2.0** in CMS → **Settings**, which builds the client image, pushes to the registry, and rebuilds the server — all in one action.
3. After the server is back, the admin clicks **Push v1.2.0** to all devices (or updates individual devices).
4. The CMS sends a `remote:update` command to the device(s) via WebSocket.
4. The sync agent forwards this to the host's update listener (port 5555).
5. The update listener runs `update.sh`, which:
   - Rewrites `CLIENT_VERSION` in `/opt/peydx/.env`
   - Pulls the new image from the registry
   - Restarts the sync-agent container

### Safety Properties

- **Failed pull = no change**: If the pull fails (network error, registry unreachable), the existing container keeps running. The script exits before restarting.
- **Rollback**: Set `clientVersion` to a previous tag in CMS Settings and push again.
- **Accessible to the sync agent container**: The update listener binds to `0.0.0.0:5555` — the sync agent (Docker container) reaches it via `host.docker.internal`, which resolves to the Docker bridge gateway IP, not `127.0.0.1`. Binding to `127.0.0.1` would reject the container's connection. Consider a firewall rule to restrict 5555 to the Docker bridge subnet (e.g. `172.16.0.0/12`) to avoid LAN exposure.

### Manual Update (Fallback)

If remote updates are unavailable, you can manually update a client:

```bash
cd /opt/peydx
# Edit CLIENT_VERSION in .env
docker compose -f docker-compose.client.yaml pull sync-agent
docker compose -f docker-compose.client.yaml up -d sync-agent
```

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
docker compose -f docker-compose.client.yaml up -d
```

The `-v` flag removes the media volume. All media will be re-downloaded on the next sync cycle.