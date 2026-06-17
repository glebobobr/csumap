package service

import (
	"context"
	"fmt"

	"csumap/internal/domain"
	"csumap/internal/repository/cache"
	"csumap/internal/repository/postgres"
)

type TileService struct {
	tileRepo *postgres.TileRepo
	cache    *cache.RedisTileCache
}

func NewTileService(tileRepo *postgres.TileRepo, tileCache *cache.RedisTileCache) *TileService {
	return &TileService{
		tileRepo: tileRepo,
		cache:    tileCache,
	}
}

func (s *TileService) GetTile(ctx context.Context, layer string, z, x, y int) ([]byte, error) {
	cacheKey := s.cacheKey(layer, z, x, y)

	if s.cache != nil {
		if cached, err := s.cache.Get(ctx, cacheKey); err == nil {
			return cached, nil
		}
	}

	tile, err := s.tileRepo.GetMVTTile(ctx, layer, z, x, y)
	if err != nil {
		return nil, err
	}

	if s.cache != nil && len(tile) > 0 {
		ttl := cache.TileCacheTTL(z)
		s.cache.Set(ctx, cacheKey, tile, ttl)
	}

	return tile, nil
}

func (s *TileService) GetTileJSON(ctx context.Context, layer string, baseURL string) (*domain.TileJSON, error) {
	data, err := s.tileRepo.GetTileJSON(ctx, layer)
	if err != nil {
		return nil, err
	}

	return &domain.TileJSON{
		TileJSON: "3.0.0",
		Name:     data.Name,
		Tiles:    []string{fmt.Sprintf("%s/tiles/%s/{z}/{x}/{y}.mvt", baseURL, layer)},
		MinZoom:  data.MinZoom,
		MaxZoom:  data.MaxZoom,
		Bounds:   []float64{-180, -90, 180, 90},
	}, nil
}

func (s *TileService) InvalidateCache(ctx context.Context, layer string, minZ, maxZ int, minLon, minLat, maxLon, maxLat float64) error {
	if s.cache != nil {
		return s.cache.InvalidateByBBox(ctx, layer, minZ, maxZ, minLon, minLat, maxLon, maxLat)
	}
	return nil
}

func (s *TileService) cacheKey(layer string, z, x, y int) string {
	return fmt.Sprintf("tile:%s:%d:%d:%d", layer, z, x, y)
}