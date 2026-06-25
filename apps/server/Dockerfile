# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /home/node/app

# Install dependencies (needs workspace package.json files for npm to resolve workspaces)
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/signage-core/package.json ./packages/signage-core/package.json
COPY apps/player/package.json ./apps/player/package.json
RUN npm install

# Copy source and build
COPY . .

# Replace real .env with placeholder for build.
# Actual secrets come from Docker Compose environment at runtime.
RUN echo "PAYLOAD_SECRET=build-placeholder" > .env

RUN npm run build -w apps/server

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /home/node/app/apps/server
ENV NODE_ENV=production

# yt-dlp (latest, for YouTube compatibility) + deno (pinned) for YouTube video conversion
RUN apk add --no-cache unzip && \
    wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    wget -q https://github.com/denoland/deno/releases/download/v2.8.3/deno-x86_64-unknown-linux-gnu.zip -O /tmp/deno.zip && \
    unzip -o /tmp/deno.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/deno && \
    rm /tmp/deno.zip

# Install production dependencies (needs workspace package.json files)
COPY package.json package-lock.json /home/node/app/
COPY apps/server/package.json /home/node/app/apps/server/package.json
COPY packages/signage-core/package.json /home/node/app/packages/signage-core/package.json
RUN cd /home/node/app && npm install --omit=dev && npm install tsx

# Copy built files from builder
COPY --from=builder /home/node/app/apps/server/.next /home/node/app/apps/server/.next
COPY --from=builder /home/node/app/apps/server/public /home/node/app/apps/server/public
COPY --from=builder /home/node/app/apps/server/server.ts /home/node/app/apps/server/server.ts
COPY --from=builder /home/node/app/apps/server/next.config.ts /home/node/app/apps/server/next.config.ts
COPY --from=builder /home/node/app/apps/server/payload.config.ts /home/node/app/apps/server/payload.config.ts
COPY --from=builder /home/node/app/apps/server/src /home/node/app/apps/server/src
COPY --from=builder /home/node/app/apps/server/app /home/node/app/apps/server/app
COPY --from=builder /home/node/app/packages/signage-core /home/node/app/packages/signage-core

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]