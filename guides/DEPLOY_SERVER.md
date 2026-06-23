# Server Deployment Guide

Deploy the Payload CMS backend as a local Docker deployment with optional Cloudflare Tunnel for secure external access.

## Minimum Hardware

| Component | Minimum | Recommended |
|---|---|---|
| CPU | Intel Core i5 (or equivalent) | Intel Core i5 |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB | 80 GB |
| OS | Ubuntu 22.04 LTS (or similar Linux) | Ubuntu 24.04 LTS |

The server runs Payload CMS, PostgreSQL, and Nginx in Docker. Media files are stored on disk and grow over time — size your storage accordingly.

## Prerequisites

- A Linux server meeting the minimum hardware above
- Docker and Docker Compose installed
- A domain name (e.g. `cms.yourchurch.org`) with DNS pointing to your server (or to Cloudflare Tunnel)
- Ports 80 and 443 open if not using Cloudflare Tunnel

### Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# 2. Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 3. Add the repository to APT sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Update your package lists
sudo apt-get update

sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker --now
sudo usermod -aG docker $USER
```

You must log out and back in (or start a new shell) for the `docker` group change to take effect. You can also run `newgrp docker` in your current session as a shortcut.

Verify:

```bash
docker --version
docker compose version
```

## Deployment

### 1. Clone the Repository

```bash
sudo mkdir /opt/peydx
sudo chown $USER /opt/peydx
git clone https://github.com/wrodie/peydx /opt/peydx
cd /opt/peydx
git checkout $(git tag --list | sort -V | tail -1)
```

### 2. Configure Environment

First, generate random secrets for `PAYLOAD_SECRET` and `SERVER_MANAGER_TOKEN`:

```bash
openssl rand -hex 32
# Run twice — once for each value, or use the one-liner below
```

Or generate both and write them directly:

```bash
echo "PAYLOAD_SECRET=$(openssl rand -hex 32)"
echo "SERVER_MANAGER_TOKEN=$(openssl rand -hex 32)"
```

Copy the generated values, then create `/opt/peydx/.env`:

```env
DATABASE_URI=postgres://peydx:<your-secure-password>@payload-db:5432/peydx
PAYLOAD_SECRET=<paste-generated-value-here>
POSTGRES_USER=peydx
POSTGRES_PASSWORD=<your-secure-password>
POSTGRES_DB=peydx
TIMEZONE=America/New_York
CORS_ORIGIN=https://cms.yourchurch.org
SERVER_MANAGER_TOKEN=<paste-generated-value-here>
```

Replace the values with your own secure credentials. `your-secure-password` must match in both `DATABASE_URI` and `POSTGRES_PASSWORD`.

- `TIMEZONE` should be an IANA timezone string (e.g. `America/New_York`, `Europe/London`, `Australia/Sydney`) and is used by the sync agent for schedule evaluation.
- `CORS_ORIGIN` is a comma-separated list of allowed origins for WebSocket connections (e.g. `https://cms.yourchurch.org,https://signage.yourchurch.org`). Required in production — if not set, no cross-origin WebSocket connections are allowed.
- `SERVER_MANAGER_TOKEN` is used to authenticate the server manager service. If you are not using the remote deploy feature, you can leave this blank — but it must be present to avoid a warning on startup.

### 3. Server Manager (Optional)

The server manager is a host-level service that receives deploy commands from the CMS. It handles git checkout, client image builds, and server rebuilds — all triggered from the admin UI.

> Skip this if you plan to update manually. If you skip it now and want to add it later, see the Server Manager setup in this guide.

```bash
sudo touch /var/log/peydx-deploy.log
sudo cp /opt/peydx/scripts/peydx-server-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable peydx-server-manager --now
```

The server manager runs as `root`, but the repository was cloned by your user — this git configuration tells git the directory is safe to use from the server manager process:

```bash
sudo git config --global --add safe.directory /opt/peydx
```

The server manager listens on port 5556.

### 4. Configure External Access (Optional)

For local/LAN access, the CMS is already available on port 80 once the stack starts. To make it available on the internet with HTTPS, configure a Cloudflare Tunnel before starting the stack — this provides secure access without opening any inbound ports on your server, with automatic HTTPS and DDoS protection.

> **Prerequisite:** Your domain must be managed by Cloudflare DNS (nameservers delegated to Cloudflare). Only the DNS management moves to Cloudflare — your existing services (AWS, etc.) stay where they are, you just recreate their DNS records in Cloudflare.

#### Cloudflare Tunnel Setup

1. Go to **Cloudflare Zero Trust** > **Networks** > **Tunnels** and click **Create a tunnel**.

2. Name the tunnel (e.g., `peydx`) and select **Docker** as the connector type.

3. Copy the tunnel token (starts with `eyJ...`). Add it to your `.env` file:

```env
CLOUDFLARE_TUNNEL_TOKEN=eyJ...
COMPOSE_PROFILES=cloudflared
```

4. Add `COMPOSE_PROFILES=cloudflared` to your `.env` file — the cloudflared service will start automatically when you run `docker compose up` in the next step.

5. After the stack is running (next step), return to the Cloudflare dashboard and configure the **Public Hostname**:

   | Field | Value |
   |---|---|
   | Subdomain | `cms` |
   | Domain | `yourchurch.org` |
   | Service | `http://nginx:80` |

   Cloudflare automatically provisions an SSL certificate for the hostname.

6. Ensure `CORS_ORIGIN` is set in your `.env` file (it should already be configured from step 2):

```env
CORS_ORIGIN=https://cms.yourchurch.org
```

Benefits of Cloudflare Tunnel:
- No open inbound ports on your server
- Automatic HTTPS with Cloudflare-managed certificates
- Built-in DDoS protection and WAF filtering
- No certificate renewal to manage

#### Alternative: Direct Access with Let's Encrypt

If you prefer direct access without Cloudflare, you can add SSL termination to nginx:

1. Add ports `443:443` to the nginx service in `docker-compose.yaml` and add certbot volume mounts.
2. Replace `nginx/conf.d/default.conf` with a config that includes HTTPS (listen on 443 with SSL certificates).
3. Install certbot and generate certificates.
4. Set up auto-renewal via cron.

This approach requires opening port 443 on your server's firewall and managing certificate renewals.

### 5. Start the Stack

```bash
docker compose up -d --build
```

If you configured Cloudflare Tunnel in step 4 (added `COMPOSE_PROFILES=cloudflared` to `.env`), the `cloudflared` container will start automatically alongside the other services.

This starts up to five containers:

- **payload-db** — PostgreSQL 16 database
- **payload-cms** — Payload CMS application (internal only, proxied through nginx)
- **nginx** — Reverse proxy (port 80, plus Docker registry on port 5050)
- **registry** — Docker registry for sync-agent images (internal only, proxied through nginx on port 5050)
- **cloudflared** *(optional)* — Cloudflare Tunnel connector (only if configured in step 4)

Verify all containers are running:

```bash
docker compose ps
```

You should be able to access the CMS immediately on port 80 (e.g., `http://192.168.1.100/admin` or `http://your-server-ip/admin`). If you configured Cloudflare, it may take a minute for the tunnel to connect and the public hostname to resolve.

### 6. Build Client Image

Build and push the sync-agent Docker image to the local registry. This image is used by client devices to run the sync agent.

```bash
cd /opt/peydx
docker build -f sync/Dockerfile -t localhost:5050/sync-agent:latest .
docker push localhost:5050/sync-agent:latest
```

Verify the image is in the registry:

```bash
curl http://localhost:5050/v2/sync-agent/tags/list
```

### 7. Create Your First Admin User

Visit the admin panel in your browser (e.g., `http://192.168.1.100/admin` or `https://cms.yourchurch.org/admin` once Cloudflare is set up) and create the first admin user.

### 8. Create Departments

In the admin panel, navigate to **Departments** and create your organizational units (e.g. "Children's Ministry", "Youth Ministry", "Digital Signage"). Each department automatically gets a root media folder and root programs folder.

### 9. Create Devices

1. Navigate to **Devices** in the admin panel.
2. Create a new device:
   - **Name**: A human-readable name (e.g. "Fellowship Hall TV")
   - **Device Type**: Choose `hardware` for a local mini PC player, or `browser` for a web-only device
   - **Departments**: Select which departments' schedules this device should display
3. After creation, Payload generates an API key. Copy it — this is used in the client deployment.

For browser devices, a `browserToken` is auto-generated. The device URL is available in the admin panel under the device record.

## Nginx Configuration

The default nginx configuration (in `nginx/conf.d/default.conf`) is set up for HTTP-only operation, with Cloudflare Tunnel handling HTTPS termination. It listens on port 80 and proxies all traffic to the Payload CMS container.

The Nginx reverse proxy handles these paths:

- **`/api/youtube-info`** and **`/api/timezone`** — Rate-limited (10 req/min per IP) unauthenticated utility endpoints.
- **`/api/ws`** — WebSocket proxy for real-time communication (device heartbeats, remote control, schedule updates). The `proxy_read_timeout 86400` (24 hours) prevents long-lived WebSocket connections from being dropped. Not rate-limited.
- **`/api/`** — Rate-limited (30 req/min per IP) catch-all for REST API requests.
- **`/`** — Standard HTTP proxy to the Payload CMS application.
- **Port 5050** — Docker registry proxy restricted to private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). External internet access is blocked.

## Docker Registry

The server includes a local Docker registry for distributing sync-agent images to client devices. The registry is proxied through Nginx on port 5050 with access restricted to private IP ranges only — external internet access is blocked. No authentication is configured since the registry is LAN-only and the source code is open.

The registry is started automatically with `docker compose up -d` and persists images in the `registry_data` volume.

### Verifying Registry Contents

```bash
curl http://localhost:5050/v2/sync-agent/tags/list
```

## Updating

### Deploying a New Version

When code is pushed and tagged (e.g. `git tag v1.2.0 && git push --tags`), deploy from the CMS (requires the server manager to be set up — see [Server Manager setup](#3-server-manager-optional)):

1. Open the admin panel and navigate to **Settings**.
2. The page will show the current server version and whether an update is available.
3. Click **Deploy v1.2.0** — this does three things:
   - Checks out the git tag `v1.2.0` on the server
   - Builds the client sync-agent image and pushes it to the local registry
   - Rebuilds and restarts the CMS server
4. The admin UI shows a reconnecting overlay and auto-refreshes when the server comes back.
5. Once the server is back, click **Push v1.2.0 to All Devices** to update client devices.

### Updating Individual Devices

To update a specific device without pushing to all:
1. Navigate to **Devices** in the admin panel.
2. Open the device record.
3. Click **Push Update** in the sidebar.

Device updates trigger the sync agent to pull the new image from the registry and restart.

### Manual Update

If the server manager is not set up, update the server manually:

```bash
cd /opt/peydx
git fetch --tags
git checkout v1.2.0  # or your target version
docker compose up -d --build
```

To manually build and push a client image:

```bash
cd /opt/peydx
docker build --build-arg VERSION=v1.2.0 -f sync/Dockerfile \
  -t localhost:5050/sync-agent:v1.2.0 \
  -t localhost:5050/sync-agent:latest .
docker push localhost:5050/sync-agent:v1.2.0
docker push localhost:5050/sync-agent:latest
```

### Log Rotation

Deploy scripts write logs to `/var/log/peydx-*.log`. These are not rotated automatically. Install logrotate to manage them:

```bash
sudo cp /opt/peydx/scripts/peydx-logrotate.conf /etc/logrotate.d/peydx
```

## Troubleshooting

### Check Container Logs

```bash
docker compose logs payload-cms     # CMS application logs
docker compose logs payload-db       # PostgreSQL logs
docker compose logs nginx            # Nginx proxy logs
docker compose logs --tail=100 -f    # Follow all logs
```

### Rebuild After Config Changes

```bash
docker compose up -d --build --force-recreate
```

### Reset the Database

This will delete **all data** including database and media uploads. Use only in development or when starting fresh:

```bash
docker compose down -v
docker compose up -d --build
```

The `-v` flag removes Docker volumes including PostgreSQL data (`postgres_data`) and uploaded media (`media_data`).

### Cloudflare Tunnel Issues

```bash
cloudflared tunnel info peydx       # Check tunnel status
journalctl -u cloudflared           # Check tunnel service logs
```

### Media Volume

Uploaded media files are stored in a named Docker volume (`media_data`), mounted into the CMS container at `/home/node/app/apps/server/media`. This keeps media uploads separate from the codebase — they persist across `git pull` and container rebuilds. No manual directory setup or permission management is needed; Docker handles the volume automatically.

To back up the media volume:

```bash
docker run --rm -v peydx_media_data:/data -v $(pwd):/backup alpine tar czf /backup/media-backup.tar.gz -C /data .
```