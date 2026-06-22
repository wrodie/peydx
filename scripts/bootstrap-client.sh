#!/usr/bin/env bash
set -euo pipefail

REPO="wrodie/peydx"
BASE_DIR="/opt/peydx"
LOG_FILE="/var/log/peydx-bootstrap.log"
UPDATE_SERVICE="/etc/systemd/system/update-listener.service"

SERVER_IP=""
API_KEY=""
TIMEZONE="UTC"
VERSION=""

print_usage() {
  cat <<EOF
Usage: bootstrap-client.sh [options]

Options:
  --server-ip <ip>    Server LAN IP address (required)
  --api-key <key>     Device API key from CMS (required)
  --timezone <tz>     IANA timezone (default: UTC)
  --version <tag>     Git tag to pull files from (default: auto-detect latest)
  --help              Show this message
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-ip) SERVER_IP="$2"; shift 2 ;;
    --api-key)   API_KEY="$2";   shift 2 ;;
    --timezone)  TIMEZONE="$2";  shift 2 ;;
    --version)   VERSION="$2";   shift 2 ;;
    --help)      print_usage ;;
    *)           echo "Unknown option: $1"; print_usage ;;
  esac
done

# Must be root
if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run as root (sudo)."
  exit 1
fi

# Required flags
if [[ -z "$SERVER_IP" ]]; then
  echo "Error: --server-ip is required"
  print_usage
fi
if [[ -z "$API_KEY" ]]; then
  echo "Error: --api-key is required"
  print_usage
fi

# Check Docker is installed
if ! command -v docker &>/dev/null; then
  echo "Error: Docker is not installed. Install Docker first: curl -fsSL https://get.docker.com | sudo sh"
  exit 1
fi

# Auto-detect latest version if not specified
if [[ -z "$VERSION" ]]; then
  echo "Detecting latest version..."
  VERSION=$(curl -sL --connect-timeout 5 "https://api.github.com/repos/$REPO/tags" \
    | python3 -c "import sys,json; t=json.load(sys.stdin); print(t[0]['name'])" 2>/dev/null || echo "master")
fi

echo "Bootstrapping from ref: $VERSION (server IP: $SERVER_IP)"
echo "Log: $LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

BASE_URL="https://raw.githubusercontent.com/$REPO/$VERSION"

# ---- Step 1: Configure Docker insecure-registries ----
echo "Configuring Docker insecure-registries..."
python3 -c "
import json, os
path = '/etc/docker/daemon.json'
existing = json.load(open(path)) if os.path.exists(path) else {}
regs = existing.get('insecure-registries', [])
entry = '$SERVER_IP:5050'
if entry not in regs:
    regs.append(entry)
    existing['insecure-registries'] = regs
    json.dump(existing, open(path, 'w'), indent=2)
    print('Added', entry)
else:
    print('Already configured')
"

if systemctl is-active --quiet docker; then
  systemctl restart docker
  echo "Docker restarted."
else
  systemctl start docker
fi

# ---- Step 2: Create /opt/peydx/ and download files ----
echo "Creating $BASE_DIR..."
mkdir -p "$BASE_DIR"

echo "Downloading files from $BASE_URL..."
FILES=(
  "docker-compose.client.yaml"
  "sync/update-listener.py"
  "sync/update.sh"
  "sync/update-listener.service"
)

for file in "${FILES[@]}"; do
  dest="$BASE_DIR/$(basename "$file")"
  echo "  $file -> $dest"
  if ! curl -sLf "$BASE_URL/$file" -o "$dest"; then
    echo "Error: Failed to download $file. Check network connectivity and that the ref '$VERSION' exists."
    exit 1
  fi
done

chmod +x "$BASE_DIR/update-listener.py" "$BASE_DIR/update.sh"

# ---- Step 3: Write .env (skip if exists) ----
ENV_FILE="$BASE_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE already exists — skipping. Update manually or remove to regenerate."
else
  cat > "$ENV_FILE" <<EOF
API_URL=http://$SERVER_IP/api
DEVICE_API_KEY=$API_KEY
TIMEZONE=$TIMEZONE
REGISTRY_URL=$SERVER_IP:5050
CLIENT_VERSION=latest
EOF
  echo ".env written."
fi

# ---- Step 4: Install update-listener service ----
echo "Installing update-listener service..."
cp "$BASE_DIR/update-listener.service" "$UPDATE_SERVICE"
systemctl daemon-reload
systemctl enable update-listener --now

# ---- Step 5: Start sync-agent ----
echo "Pulling and starting sync-agent..."
docker compose -f "$BASE_DIR/docker-compose.client.yaml" pull sync-agent
docker compose -f "$BASE_DIR/docker-compose.client.yaml" up -d

# ---- Done ----
cat <<EOF

Bootstrap complete!

  Server:     $SERVER_IP
  Version:    $VERSION
  Directory:  $BASE_DIR

What's next:
  1. Verify the sync agent is running:
       sudo docker compose -f $BASE_DIR/docker-compose.client.yaml ps
       sudo docker compose -f $BASE_DIR/docker-compose.client.yaml logs -f

  2. Set up the Chromium kiosk (see DEPLOY_CLIENT.md for details)

  3. The device should appear as "online" in the CMS dashboard within 30 seconds.
EOF
