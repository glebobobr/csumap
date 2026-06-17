package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"csumap/internal/config"
	"csumap/internal/repository/cache"
	"csumap/internal/repository/postgres"
	"csumap/internal/service"
	httptransport "csumap/internal/transport/http"
	"csumap/internal/transport/http/handlers"
	"csumap/internal/transport/http/middleware"

	"go.uber.org/zap"
)

func main() {
	cfg := config.Load()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	ctx := context.Background()

	db, err := postgres.New(ctx, &postgres.Config{
		DSN:             cfg.Database.DSN,
		MaxConns:        cfg.Database.MaxConns,
		MinConns:        cfg.Database.MinConns,
		MaxConnLifetime: cfg.Database.MaxConnLifetime,
		MaxConnIdleTime: cfg.Database.MaxConnIdleTime,
	})
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	var tileCache *cache.RedisTileCache
	if cfg.Redis.Address != "" {
		tileCache, _ = cache.NewRedisTileCache(
			cfg.Redis.Address,
			cfg.Redis.Password,
			cfg.Redis.DB,
			cfg.Redis.PoolSize,
		)
	}

	tileRepo := postgres.NewTileRepo(db)
	featureRepo := postgres.NewFeatureRepo(db)
	layerRepo := postgres.NewLayerRepo(db)

	tileService := service.NewTileService(tileRepo, tileCache)
	featureService := service.NewFeatureService(featureRepo, tileService)
	layerService := service.NewLayerService(layerRepo)

	tileHandler := handlers.NewTileHandler(tileService, "http://localhost:8080")
	featureHandler := handlers.NewFeatureHandler(featureService)
	layerHandler := handlers.NewLayerHandler(layerService)
	adminHandler := handlers.NewAdminHandler(featureService, layerService)
	authHandler := handlers.NewAuthHandler(cfg)

	authMiddleware := middleware.NewAuthMiddleware(cfg.JWT.Secret)

	router := httptransport.NewRouter(httptransport.RouterConfig{
		TileHandler:    tileHandler,
		FeatureHandler: featureHandler,
		LayerHandler:   layerHandler,
		AdminHandler:   adminHandler,
		AuthHandler:    authHandler,
		AuthMiddleware: authMiddleware,
		Logger:         logger,
	})

	srv := &http.Server{
		Addr:         cfg.Server.Address,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	go func() {
		logger.Info("starting server", zap.String("addr", cfg.Server.Address))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	logger.Info("server exited")
}