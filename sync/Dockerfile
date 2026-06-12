FROM node:20-alpine
WORKDIR /app

# Copy package manifests for dependency install (layer caching)
COPY package*.json ./
COPY apps/player/package.json ./apps/player/
COPY packages/signage-core/package.json ./packages/signage-core/

RUN npm install

# Copy source
COPY apps/player/ ./apps/player/
COPY packages/signage-core/ ./packages/signage-core/
COPY sync/ ./sync/

# Build player app
RUN npm run build -w apps/player

ENV NODE_ENV=production
ENV LOCAL_DIR=/app/media
ENV SCHEDULE_PATH=/app/media/schedule.json

RUN mkdir -p /app/media

EXPOSE 5000
CMD ["node", "sync/sync-agent.js"]
