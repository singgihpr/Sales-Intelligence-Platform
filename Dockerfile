# Stage 1: Build Go binary
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 3: Production runtime
FROM alpine:3.19
WORKDIR /app

# Install ca-certificates for SSL/TLS
RUN apk --no-cache add ca-certificates

# Copy Go binary
COPY --from=builder /app/server .

# Copy frontend dist
COPY --from=frontend-builder /app/dist ./dist

# Copy migrations
COPY migrations/ ./migrations/

EXPOSE 3000
CMD ["./server"]
