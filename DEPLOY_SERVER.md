# Server Deployment Guide (Payload CMS + Lightsail)

This guide covers deploying the central Brain of the signage system using Docker.

## 1. Prerequisites
- AWS Lightsail instance (2GB RAM / 1 vCPU minimum recommended).
- A Static IP attached to the instance.
- Port 80 and 443 opened in the Lightsail Networking firewall.
- Domain A-Record pointing to your Static IP.

## 2. Server Preparation
On your Lightsail instance, install Docker and Docker Compose using: sudo apt-get update && sudo apt-get install docker.io docker-compose -y

## 3. Directory Structure
Ensure your files are uploaded to the server as follows:
- /peydx/docker-compose.yml
- /peydx/.env
- /peydx/apps/server/
- /peydx/nginx/

## 4. Environment Configuration
Edit your .env file on the server with your POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, and PAYLOAD_SECRET.

## 5. Launch
Run the command: docker-compose up -d --build

## 6. SSL Configuration (Let's Encrypt)
Run the Certbot docker command to generate certificates, then restart Nginx using: docker-compose restart nginx

