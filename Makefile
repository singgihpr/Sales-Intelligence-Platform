.PHONY: build run test clean lint dev

APP_NAME = server

build:
	go build -o bin/$(APP_NAME) ./cmd/server

run:
	go run ./cmd/server

test:
	go test ./... -v -cover

clean:
	rm -rf bin/

lint:
	go vet ./...
	staticcheck ./...

dev:
	air

# Database
migrate:
	go run ./cmd/migrate

seed:
	go run ./cmd/seed

# Docker
docker-build:
	docker build -t sales-intelligence-platform .

docker-run:
	docker run -p 3000:3000 sales-intelligence-platform

# Generate swagger docs (future)
# swagger:
# 	swag init -g cmd/server/main.go -o docs
