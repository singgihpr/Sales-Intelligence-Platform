package router

import (
	"net/http"

	"github.com/ayofresh/sales-intelligence-platform/internal/config"
	"github.com/ayofresh/sales-intelligence-platform/internal/handler"
	appmw "github.com/ayofresh/sales-intelligence-platform/internal/middleware"
	"github.com/ayofresh/sales-intelligence-platform/internal/repository"
	"github.com/ayofresh/sales-intelligence-platform/internal/service"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

func New(cfg *config.Config, pool *pgxpool.Pool) *chi.Mux {
	// --- Repository Layer ---
	userRepo := repository.NewUserRepo(pool)
	outletRepo := repository.NewOutletRepo(pool)
	recordRepo := repository.NewSalesRecordRepo(pool)
	targetRepo := repository.NewTargetRepo(pool)
	assignRepo := repository.NewAssignmentRepo(pool)

	// --- Service Layer ---
	authService := service.NewAuthService(userRepo, cfg)
	dashboardService := service.NewDashboardService(userRepo, outletRepo, recordRepo, targetRepo, assignRepo)
	uploadService := service.NewUploadService(outletRepo, recordRepo, userRepo, assignRepo)

	// --- Handler Layer ---
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userRepo, authService)
	profileHandler := handler.NewProfileHandler(userRepo, authService)
	outletHandler := handler.NewOutletHandler(outletRepo)
	recordHandler := handler.NewRecordHandler(recordRepo)
	targetHandler := handler.NewTargetHandler(targetRepo)
	assignmentHandler := handler.NewAssignmentHandler(assignRepo, outletRepo)
	dashboardHandler := handler.NewDashboardHandler(dashboardService)
	uploadHandler := handler.NewUploadHandler(uploadService)

	// --- Router ---
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.Recoverer)
	r.Use(appmw.Logger)
	r.Use(appmw.CORS(cfg.CorsOrigin))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Public
		r.Post("/auth", authHandler.Login)

		// Authenticated
		r.Group(func(r chi.Router) {
			r.Use(appmw.Auth(cfg.JWTSecret))

			// Dashboard
			r.Get("/dashboard", dashboardHandler.Get)

			// Profile
			r.Get("/profile", profileHandler.Get)
			r.Put("/profile", profileHandler.Update)

			// Users
			r.Get("/users", userHandler.List)
			r.Post("/users", userHandler.Create)
			r.Put("/users", userHandler.Update)
			r.Delete("/users", userHandler.Delete)

			// Outlets
			r.Get("/outlets", outletHandler.List)
			r.Post("/outlets", outletHandler.Create)
			r.Put("/outlets", outletHandler.Update)
			r.Delete("/outlets", outletHandler.Delete)

			// Sales Records
			r.Get("/records", recordHandler.List)
			r.Post("/records", recordHandler.Create)
			r.Put("/records", recordHandler.Update)
			r.Delete("/records", recordHandler.Delete)
			r.Get("/records/history", recordHandler.GetHistory)

			// Targets
			r.Get("/targets", targetHandler.List)
			r.Post("/targets", targetHandler.Create)
			r.Put("/targets", targetHandler.Update)
			r.Delete("/targets", targetHandler.Delete)

			// Assignments
			r.Get("/assignments", assignmentHandler.List)
			r.Post("/assignments", assignmentHandler.Create)
			r.Put("/assignments", assignmentHandler.Unassign)
			r.Delete("/assignments", assignmentHandler.Delete)

			// File Upload
			r.Post("/upload", uploadHandler.Upload)
		})
	})

	return r
}
