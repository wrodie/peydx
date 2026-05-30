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

COPY package*.json ./
RUN npm install --production

# Copy built files from builder
COPY --from=builder /home/node/app/.next ./.next
COPY --from=builder /home/node/app/server.ts ./
COPY --from=builder /home/node/app/next.config.ts ./
COPY --from=builder /home/node/app/public ./public

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
