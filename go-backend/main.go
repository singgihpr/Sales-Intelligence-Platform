package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

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

	// Run migrations
	runMigrations()

	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}))

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// API routes
	api := e.Group("/api")

	// Auth handler
	authHandler := &handlers.AuthHandler{
		JWTSecret:      cfg.JWTSecret,
		DefaultPassword: cfg.DefaultPassword,
	}
	api.POST("", authHandler.Login)

	// User handler
	userHandler := &handlers.UserHandler{
		DefaultPassword: cfg.DefaultPassword,
	}

	// Outlet handler
	outletHandler := &handlers.OutletHandler{}

	// Record handler
	recordHandler := &handlers.RecordHandler{}

	// Assignment handler
	assignmentHandler := &handlers.AssignmentHandler{}

	// Target handler
	targetHandler := &handlers.TargetHandler{}

	// Incentive handler
	incentiveHandler := &handlers.IncentiveHandler{}

	// Upload handler
	uploadHandler := &handlers.UploadHandler{}

	// Protected routes
	protected := api.Group("")
	protected.Use(jwtmiddleware.JWTAuth(cfg.JWTSecret))

	// Profile
	protected.GET("", func(c echo.Context) error {
		user := jwtmiddleware.GetUser(c)
		if user == nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		}

		// Check if it's a profile request
		if c.QueryParam("type") == "profile" {
			return userHandler.GetProfile(c)
		}

		// Check if it's a dashboard request
		if c.QueryParam("type") == "" {
			return userHandler.GetDashboard(c)
		}

		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	// Users
	protected.GET("/users", func(c echo.Context) error {
		if c.QueryParam("type") == "users" {
			return userHandler.ListUsers(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.POST("/users", func(c echo.Context) error {
		if c.QueryParam("type") == "users" {
			return userHandler.CreateUser(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.PUT("/users", func(c echo.Context) error {
		if c.QueryParam("type") == "users" {
			return userHandler.UpdateUser(c)
		}
		if c.QueryParam("type") == "profile" {
			return userHandler.UpdateProfile(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.DELETE("/users", func(c echo.Context) error {
		if c.QueryParam("type") == "users" {
			return userHandler.DeleteUser(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	// Outlets
	protected.GET("/outlets", func(c echo.Context) error {
		if c.QueryParam("type") == "outlets" {
			return outletHandler.ListOutlets(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.POST("/outlets", func(c echo.Context) error {
		if c.QueryParam("type") == "outlets" {
			return outletHandler.CreateOutlet(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.PUT("/outlets", func(c echo.Context) error {
		if c.QueryParam("type") == "outlets" {
			return outletHandler.UpdateOutlet(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.DELETE("/outlets", func(c echo.Context) error {
		if c.QueryParam("type") == "outlets" {
			return outletHandler.DeleteOutlet(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	// Records
	protected.GET("/records", func(c echo.Context) error {
		if c.QueryParam("type") == "records" {
			return recordHandler.ListRecords(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.PUT("/records", func(c echo.Context) error {
		if c.QueryParam("type") == "records" {
			return recordHandler.UpdateRecord(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.DELETE("/records", func(c echo.Context) error {
		if c.QueryParam("type") == "records" {
			return recordHandler.DeleteRecord(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	// Assignments
	protected.GET("/assignments", func(c echo.Context) error {
		if c.QueryParam("type") == "assignments" {
			return assignmentHandler.ListAssignments(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.POST("/assignments", func(c echo.Context) error {
		if c.QueryParam("type") == "assignments" {
			return assignmentHandler.CreateAssignment(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.PUT("/assignments", func(c echo.Context) error {
		if c.QueryParam("type") == "assignments" {
			return assignmentHandler.UpdateAssignment(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.DELETE("/assignments", func(c echo.Context) error {
		if c.QueryParam("type") == "assignments" {
			return assignmentHandler.DeleteAssignment(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	// Targets
	protected.GET("/targets", func(c echo.Context) error {
		if c.QueryParam("type") == "targets" {
			return targetHandler.ListTargets(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.POST("/targets", func(c echo.Context) error {
		if c.QueryParam("type") == "targets" {
			return targetHandler.CreateTarget(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.PUT("/targets", func(c echo.Context) error {
		if c.QueryParam("type") == "targets" {
			return targetHandler.UpdateTarget(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.DELETE("/targets", func(c echo.Context) error {
		if c.QueryParam("type") == "targets" {
			return targetHandler.DeleteTarget(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	// Incentives
	protected.GET("/incentives", func(c echo.Context) error {
		if c.QueryParam("type") == "sku-incentives" {
			return incentiveHandler.ListIncentives(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.POST("/incentives", func(c echo.Context) error {
		if c.QueryParam("type") == "sku-incentives" {
			return incentiveHandler.CreateIncentive(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.PUT("/incentives", func(c echo.Context) error {
		if c.QueryParam("type") == "sku-incentives" {
			return incentiveHandler.UpdateIncentive(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	protected.DELETE("/incentives", func(c echo.Context) error {
		if c.QueryParam("type") == "sku-incentives" {
			return incentiveHandler.DeleteIncentive(c)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	})

	// Upload
	protected.POST("/upload", func(c echo.Context) error {
		return uploadHandler.UploadExcel(c)
	})

	// Serve static files (frontend)
	frontendDir := os.Getenv("FRONTEND_DIR")
	if frontendDir == "" {
		frontendDir = "./dist"
	}

	// Serve index.html for all non-API routes (SPA support)
	e.GET("/*", func(c echo.Context) error {
		path := c.Request().URL.Path
		if path == "/" {
			return c.File(filepath.Join(frontendDir, "index.html"))
		}

		// Check if file exists
		fullPath := filepath.Join(frontendDir, path)
		if _, err := os.Stat(fullPath); err == nil {
			return c.File(fullPath)
		}

		// Fallback to index.html for SPA routing
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
