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
COPY --from=builder /home/node/app/dist ./dist
COPY --from=builder /home/node/app/build ./build
COPY --from=builder /home/node/app/next.config.mjs ./ # If using v3

EXPOSE 3000
CMD ["node", "dist/server.js"]
