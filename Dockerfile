# Stage 1: Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server/ ./server/
COPY netlify/functions/lib/ ./netlify/functions/lib/
COPY migrations/ ./migrations/

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/index.js"]
