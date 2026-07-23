package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"

	"sales-intelligence/config"
	"sales-intelligence/db"
	"sales-intelligence/handlers"
	jwtmiddleware "sales-intelligence/middleware"
)

func main() {
	cfg := config.Load()

	if err := db.Connect(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	runMigrations()

	e := echo.New()
	e.HideBanner = true

	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.CORSWithConfig(echomiddleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}))

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// Handlers
	authHandler := &handlers.AuthHandler{JWTSecret: cfg.JWTSecret, DefaultPassword: cfg.DefaultPassword}
	userHandler := &handlers.UserHandler{DefaultPassword: cfg.DefaultPassword}
	outletHandler := &handlers.OutletHandler{}
	recordHandler := &handlers.RecordHandler{}
	assignmentHandler := &handlers.AssignmentHandler{}
	targetHandler := &handlers.TargetHandler{}
	incentiveHandler := &handlers.IncentiveHandler{}
	skUHandler := &handlers.SKUHandler{}
	uploadHandler := &handlers.UploadHandler{}

	// ── POST /api ──────────────────────────────────────────────
	// Auth (public) + all create endpoints (protected)
	api := e.Group("/api")

	api.POST("", func(c echo.Context) error {
		// Login is public — no JWT required
		if c.QueryParam("type") == "auth" {
			return authHandler.Login(c)
		}

		// Everything else requires JWT
		_, err := jwtmiddleware.VerifyJWT(c, cfg.JWTSecret)
		if err != nil {
			return err
		}

		t := c.QueryParam("type")
		if c.QueryParam("action") == "preview" {
			return uploadHandler.PreviewExcel(c)
		}
		switch t {
		case "users":
			return userHandler.CreateUser(c)
		case "outlets":
			return outletHandler.CreateOutlet(c)
		case "assignments":
			return assignmentHandler.CreateAssignment(c)
		case "targets":
			return targetHandler.CreateTarget(c)
		case "sku-incentives":
			return incentiveHandler.CreateIncentive(c)
		default:
			// Non-JSON body with no recognized type → Excel upload
			contentType := c.Request().Header.Get("Content-Type")
			if strings.Contains(contentType, "application/json") || strings.Contains(contentType, "text/plain") {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
			}
			return uploadHandler.UploadExcel(c)
		}
	})

	// ── GET /api ───────────────────────────────────────────────
	// All GET endpoints (protected)
	api.GET("", func(c echo.Context) error {
		if _, err := jwtmiddleware.VerifyJWT(c, cfg.JWTSecret); err != nil {
			return err
		}

		t := c.QueryParam("type")
		switch t {
		case "profile":
			return userHandler.GetProfile(c)
		case "users":
			return userHandler.ListUsers(c)
		case "outlets":
			return outletHandler.ListOutlets(c)
		case "records":
			return recordHandler.ListRecords(c)
		case "assignments":
			return assignmentHandler.ListAssignments(c)
		case "targets":
			return targetHandler.ListTargets(c)
		case "sku-incentives":
			return incentiveHandler.ListIncentives(c)
		case "skus":
			return skUHandler.ListSKUs(c)
		case "outlet-history":
			return outletHandler.GetOutletHistory(c)
		case "analytics":
			return userHandler.GetAnalytics(c)
		case "":
			return userHandler.GetDashboard(c)
		default:
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		}
	})

	// ── PUT /api ───────────────────────────────────────────────
	// All update endpoints (protected)
	api.PUT("", func(c echo.Context) error {
		if _, err := jwtmiddleware.VerifyJWT(c, cfg.JWTSecret); err != nil {
			return err
		}

		t := c.QueryParam("type")
		switch t {
		case "profile":
			return userHandler.UpdateProfile(c)
		case "users":
			return userHandler.UpdateUser(c)
		case "outlets":
			return outletHandler.UpdateOutlet(c)
		case "assignments":
			return assignmentHandler.UpdateAssignment(c)
		case "targets":
			return targetHandler.UpdateTarget(c)
		case "sku-incentives":
			return incentiveHandler.UpdateIncentive(c)
		default:
			return recordHandler.UpdateRecord(c)
		}
	})

	// ── DELETE /api ────────────────────────────────────────────
	// All delete endpoints (protected)
	api.DELETE("", func(c echo.Context) error {
		if _, err := jwtmiddleware.VerifyJWT(c, cfg.JWTSecret); err != nil {
			return err
		}

		t := c.QueryParam("type")
		switch t {
		case "users":
			return userHandler.DeleteUser(c)
		case "outlets":
			return outletHandler.DeleteOutlet(c)
		case "assignments":
			return assignmentHandler.DeleteAssignment(c)
		case "targets":
			return targetHandler.DeleteTarget(c)
		case "sku-incentives":
			return incentiveHandler.DeleteIncentive(c)
		default:
			return recordHandler.DeleteRecord(c)
		}
	})

	// ── Static files (SPA frontend) ────────────────────────────
	frontendDir := os.Getenv("FRONTEND_DIR")
	if frontendDir == "" {
		frontendDir = "./dist"
	}

	e.GET("/*", func(c echo.Context) error {
		path := c.Request().URL.Path
		if path == "/" {
			return c.File(filepath.Join(frontendDir, "index.html"))
		}
		fullPath := filepath.Join(frontendDir, path)
		if _, err := os.Stat(fullPath); err == nil {
			return c.File(fullPath)
		}
		return c.File(filepath.Join(frontendDir, "index.html"))
	})

	port := cfg.Port
	if port == "" {
		port = "3000"
	}
	e.Logger.Fatal(e.Start(":" + port))
}

func runMigrations() {
	migrationDir := "./migrations"
	if _, err := os.Stat(migrationDir); os.IsNotExist(err) {
		return
	}
	files, err := filepath.Glob(filepath.Join(migrationDir, "*.sql"))
	if err != nil {
		log.Printf("Warning: Failed to read migration files: %v", err)
		return
	}
	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			log.Printf("Warning: Failed to read migration %s: %v", file, err)
			continue
		}
		_, err = db.Pool.Exec(context.Background(), string(content))
		if err != nil {
			log.Printf("Warning: Migration %s failed: %v", filepath.Base(file), err)
		} else {
			log.Printf("Migration %s applied successfully", filepath.Base(file))
		}
	}
}
