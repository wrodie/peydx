FROM node:20-alpine
WORKDIR /app

# Copy root package.json for npm dependencies (axios, express, socket.io, dotenv)
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy sync agent code
COPY sync/sync-agent.js ./sync/
COPY sync/sync-utils.js ./sync/

EXPOSE 5000
CMD ["node", "sync/sync-agent.js"]
