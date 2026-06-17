package http

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"

	"csumap/internal/api"
	"csumap/internal/transport/http/handlers"
	"csumap/internal/transport/http/middleware"
)

type RouterConfig struct {
	TileHandler    *handlers.TileHandler
	FeatureHandler *handlers.FeatureHandler
	LayerHandler   *handlers.LayerHandler
	AdminHandler   *handlers.AdminHandler
	AuthHandler    *handlers.AuthHandler
	AuthMiddleware *middleware.AuthMiddleware
	Logger         *zap.Logger
}

func NewRouter(cfg RouterConfig) http.Handler {
	// Create composite handler that implements api.ServerInterface
	compositeHandler := NewCompositeHandler(
		cfg.TileHandler,
		cfg.FeatureHandler,
		cfg.LayerHandler,
		cfg.AdminHandler,
		cfg.AuthMiddleware,
		cfg.Logger,
	)

	// Create router using generated code
	r := chi.NewRouter()

	// Add global middleware
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.CORS())

	if cfg.Logger != nil {
		r.Use(middleware.Logger(cfg.Logger))
	}

	// Health and metrics (not in OpenAPI spec)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	r.Handle("/metrics", promhttp.Handler())

	// Register API routes from OpenAPI spec
	api.HandlerFromMux(compositeHandler, r)

	// Public layer routes
	r.Get("/api/v1/layers", cfg.LayerHandler.ListLayers)

	// Auth routes (public)
	r.Post("/api/v1/auth/token", cfg.AuthHandler.Login)

	// PUBLIC - only published features (for map users)
	r.Get("/api/v1/layers/{layerID}/features", cfg.FeatureHandler.GetPublicFeatures)

	// PRIVATE (admin) - all features including drafts
	r.Group(func(r chi.Router) {
		r.Use(cfg.AuthMiddleware.JWT)

		// Layer management
		r.Post("/api/v1/layers", cfg.LayerHandler.CreateLayer)
		r.Put("/api/v1/layers/{layerID}", cfg.LayerHandler.UpdateLayer)
		r.Delete("/api/v1/layers/{layerID}", cfg.LayerHandler.DeleteLayer)

		// Feature CRUD (admin) - creates as draft
		r.Get("/api/v1/admin/layers/{layerID}/features", cfg.AdminHandler.GetAdminFeatures)
		r.Post("/api/v1/admin/layers/{layerID}/features", cfg.FeatureHandler.CreateFeature)
		r.Put("/api/v1/admin/features/{id}", cfg.FeatureHandler.UpdateFeature)
		r.Delete("/api/v1/admin/features/{id}", cfg.FeatureHandler.DeleteFeature)
		r.Post("/api/v1/admin/layers/{layerID}/features/replace", cfg.FeatureHandler.ReplaceFeatures)

		// Import/Export
		r.Post("/api/v1/layers/{layerID}/import", cfg.AdminHandler.ImportGeoJSON)
		r.Get("/api/v1/layers/{layerID}/export", cfg.AdminHandler.ExportGeoJSON)

		// Publish
		r.Post("/api/v1/admin/features/{id}/publish", cfg.AdminHandler.PublishFeature)
		r.Post("/api/v1/admin/features/publish-all", cfg.AdminHandler.PublishAll)
	})

	staticDir := "./dist"
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		staticDir = "../dist"
	}
	if _, err := os.Stat(staticDir); err == nil {
		fs := http.FileServer(http.Dir(staticDir))
		r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") ||
				strings.HasPrefix(r.URL.Path, "/tiles/") ||
				strings.HasPrefix(r.URL.Path, "/health") ||
				strings.HasPrefix(r.URL.Path, "/metrics") {
				http.NotFound(w, r)
				return
			}
			path := filepath.Join(staticDir, r.URL.Path)
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		}))
	}

	return r
}