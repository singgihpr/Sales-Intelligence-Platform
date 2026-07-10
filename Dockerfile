# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY go-backend/go.mod go-backend/go.sum ./
RUN go mod download
COPY go-backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server .

# Stage 3: Production runtime
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy Go binary
COPY --from=backend /server ./server

# Copy frontend build
COPY --from=frontend /app/dist ./dist

# Copy migrations
COPY migrations/ ./migrations/

ENV GIN_MODE=release
ENV FRONTEND_DIR=./dist
EXPOSE 3000

CMD ["./server"]
