package main

import (
	"log"
	"net/http"
	"os"

	"github.com/ayofresh/sales-intelligence-platform/internal/config"
	"github.com/ayofresh/sales-intelligence-platform/internal/repository"
	"github.com/ayofresh/sales-intelligence-platform/internal/router"
)

func main() {
	cfg := config.Load()

	pool, err := repository.NewPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	r := router.New(cfg, pool)

	addr := ":" + cfg.Port
	log.Printf("Server starting on %s (env=%s)", addr, cfg.Environment)

	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	if err := srv.ListenAndServe(); err != nil {
		log.Printf("Server stopped: %v", err)
		os.Exit(1)
	}
}
