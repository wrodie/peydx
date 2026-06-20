# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /home/node/app
ENV NODE_ENV=production

# yt-dlp (latest, for YouTube compatibility) + deno (pinned) for YouTube video conversion
RUN apk add --no-cache unzip && \
    wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    wget -q https://github.com/denoland/deno/releases/download/v2.8.3/deno-x86_64-unknown-linux-gnu.zip -O /tmp/deno.zip && \
    unzip -o /tmp/deno.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/deno && \
    rm /tmp/deno.zip

COPY package*.json ./
RUN npm install --production

# Copy built files from builder
COPY --from=builder /home/node/app/.next ./.next
COPY --from=builder /home/node/app/server.ts ./
COPY --from=builder /home/node/app/next.config.ts ./
COPY --from=builder /home/node/app/public ./public

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
