# Client Deployment Guide (HP i5 Player)

This guide covers setting up the Player and Sync Agent on the local hardware.

## 1. Prerequisites
- Ubuntu Desktop installed.
- Node.js (LTS) installed.
- PM2 installed globally: sudo npm install -g pm2

## 2. Setup
1. Clone your repository: git clone <your-repo-url>
2. Install dependencies: npm install
3. Build the Player: cd apps/player && npm run build

## 3. Process Management
We use PM2 to ensure the apps stay running. From the project root, run:
- pm2 start ecosystem.config.js
- pm2 save
- pm2 startup (and follow the on-screen instructions)

## 4. Kiosk Mode (Auto-Start Browser)
1. Install Chromium: sudo apt install chromium-browser
2. Create a startup script kiosk.sh that runs: chromium-browser --kiosk --incognito http://localhost:5000
3. Add this script to "Startup Applications" in Ubuntu settings.

## 5. Local Media Path
The Sync Agent downloads files to: ./apps/player/static/local-media
The SvelteKit player serves these as static assets at the /local-media/ URL path.
