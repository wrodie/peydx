# Server Deployment Guide

Deploy the Payload CMS backend as a local Docker deployment with optional Cloudflare Tunnel for secure external access.

## Minimum Hardware

| Component | Minimum | Recommended |
|---|---|---|
| CPU | Intel Core i5 (or equivalent) | Intel Core i5 |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB SSD | 80 GB SSD |
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
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable docker --now
```

Verify:

```bash
docker --version
docker compose version
```

## Deployment

### 1. Clone the Repository

```bash
git clone <your-repo-url> /opt/peydx
cd /opt/peydx
```

### 2. Configure Environment

Create `/opt/peydx/.env`:

```env
DATABASE_URI=postgres://peydx:your-secure-password@payload-db:5432/peydx
PAYLOAD_SECRET=a-long-random-secret-key
POSTGRES_USER=peydx
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=peydx
TIMEZONE=America/New_York
```

Replace the values with your own secure credentials. `TIMEZONE` should be an IANA timezone string (e.g. `America/New_York`, `Europe/London`, `Australia/Sydney`) and is used by the sync agent for schedule evaluation.

### 3. Start the Stack

```bash
docker compose up -d --build
```

This starts three containers:

- **payload-db** — PostgreSQL 16 database
- **payload-cms** — Payload CMS application (Next.js on port 3000, internal only)
- **nginx** — Reverse proxy with SSL termination (ports 80 and 443)

Verify all containers are running:

```bash
docker compose ps
```

### 4. Configure SSL / External Access

You have two options for securing external access to the CMS:

#### Option A: Cloudflare Tunnel (Recommended)

Cloudflare Tunnel provides secure access without opening any inbound ports on your server. All traffic is proxied through Cloudflare's network with automatic HTTPS.

1. Install `cloudflared`:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

2. Authenticate with Cloudflare:

```bash
cloudflared tunnel login
```

3. Create a tunnel:

```bash
cloudflared tunnel create peydx
```

4. Configure the tunnel route. Create `~/.cloudflared/config.yml`:

```yaml
tunnel: peydx
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: cms.yourchurch.org
    service: http://localhost:80
  - service: http://localhost:80
```

5. Add a DNS record pointing `cms.yourchurch.org` to the tunnel:

```bash
cloudflared tunnel route dns peydx cms.yourchurch.org
```

6. Run the tunnel (as a service for persistence):

```bash
sudo cloudflared service install
```

7. Update Nginx configuration. Since Cloudflare handles TLS termination, edit `nginx/conf.d/default.conf` to listen only on port 80 (remove the HTTPS server block):

```nginx
server {
    listen 80;
    server_name cms.yourchurch.org;

    location /api/ws {
        proxy_pass http://payload-cms:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://payload-cms:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

8. Restart Nginx:

```bash
docker compose restart nginx
```

Benefits of Cloudflare Tunnel:
- No open inbound ports on your server
- Automatic HTTPS with Cloudflare-managed certificates
- Built-in DDoS protection
- No certificate renewal to manage

#### Option B: Local Nginx with Let's Encrypt

If you prefer direct access with ports 80/443 open:

1. Ensure your domain DNS points to the server's public IP.
2. The default `nginx/conf.d/default.conf` is pre-configured for HTTPS with Let's Encrypt. Replace `cms.yourchurch.org` with your domain.
3. Generate SSL certificates:

```bash
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  -d cms.yourchurch.org \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email
```

You need to add a Certbot container to `docker-compose.yaml` or run certbot directly. The Nginx config references certificates at `/etc/letsencrypt/live/cms.yourchurch.org/`.

4. Restart Nginx:

```bash
docker compose restart nginx
```

5. Set up auto-renewal via cron:

```bash
echo "0 0 * * * docker compose -f /opt/peydx/docker-compose.yaml run --rm certbot renew && docker compose -f /opt/peydx/docker-compose.yaml restart nginx" | sudo crontab -
```

### 5. Create Your First Admin User

Visit `https://cms.yourchurch.org/admin` (or `http://localhost:3000/admin` for development) and create the first admin user.

### 6. Create Departments

In the admin panel, navigate to **Departments** and create your organizational units (e.g. "Children's Ministry", "Youth Ministry", "Digital Signage"). Each department automatically gets a root media folder and root programs folder.

### 7. Create Devices

1. Navigate to **Devices** in the admin panel.
2. Create a new device:
   - **Name**: A human-readable name (e.g. "Fellowship Hall TV")
   - **Device Type**: Choose `hardware` for a local mini PC player, or `browser` for a web-only device
   - **Departments**: Select which departments' schedules this device should display
3. After creation, Payload generates an API key. Copy it — this is used in the client deployment.

For browser devices, a `browserToken` is auto-generated. The device URL is available in the admin panel under the device record.

## Nginx Configuration

The Nginx reverse proxy handles two critical paths:

- **`/api/ws`** — WebSocket proxy for real-time communication (device heartbeats, remote control, schedule updates). The `proxy_read_timeout 86400` (24 hours) prevents long-lived WebSocket connections from being dropped.
- **`/`** — Standard HTTP proxy to the Payload CMS application.

## Updating

To update the server to a new version:

```bash
cd /opt/peydx
git pull
docker compose up -d --build
```

This rebuilds the Payload CMS container and restarts all services. Database data persists across updates via the `postgres_data` Docker volume.

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

Uploaded media files are stored in a named Docker volume (`media_data`), mounted into the CMS container at `/home/node/app/media`. This keeps media uploads separate from the codebase — they persist across `git pull` and container rebuilds. No manual directory setup or permission management is needed; Docker handles the volume automatically.

To back up the media volume:

```bash
docker run --rm -v peydx_media_data:/data -v $(pwd):/backup alpine tar czf /backup/media-backup.tar.gz -C /data .
```