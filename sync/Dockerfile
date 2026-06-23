# Stage 1 — Builder: compile the player app
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace config + package manifests
COPY package.json package-lock.json ./
COPY apps/player/package.json ./apps/player/
COPY packages/signage-core/package.json ./packages/signage-core/

# Install ALL deps (including dev — needed for vite build)
RUN npm ci

# Copy source code for player and its workspace dependency
COPY apps/player/ ./apps/player/
COPY packages/signage-core/ ./packages/signage-core/

# Build the player
RUN npm run build -w apps/player

# Stage 2 — Production: minimal runtime image
FROM node:20-alpine
WORKDIR /app

# Production deps only (express, axios, socket.io, dotenv)
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy sync agent code
COPY sync/sync-agent.js ./sync/
COPY sync/sync-utils.js ./sync/

# Copy pre-built player from builder stage
COPY --from=builder /app/apps/player/dist ./apps/player/dist

EXPOSE 5000
CMD ["node", "sync/sync-agent.js"]
