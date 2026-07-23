.PHONY: backend-build backend-run backend-test backend-clean backend-lint backend-fmt backend-dev

APP_NAME = server
BACKEND_DIR = backend

backend-build:
	cd $(BACKEND_DIR) && go build -o ../bin/$(APP_NAME) ./cmd/server

backend-run:
	cd $(BACKEND_DIR) && go run ./cmd/server

backend-test:
	cd $(BACKEND_DIR) && go test ./... -race -cover

backend-clean:
	rm -rf bin/

backend-lint:
	cd $(BACKEND_DIR) && go vet ./...

backend-fmt:
	cd $(BACKEND_DIR) && gofmt -w .

backend-dev:
	cd $(BACKEND_DIR) && air

# Docker
docker-build:
	docker build -t sales-intelligence-platform .

docker-run:
	docker run -p 3000:3000 sales-intelligence-platform
