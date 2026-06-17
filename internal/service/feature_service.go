package service

import (
	"context"

	"csumap/internal/domain"
	"csumap/internal/repository/postgres"
)

type FeatureService struct {
	featureRepo *postgres.FeatureRepo
	tileService *TileService
}

func NewFeatureService(featureRepo *postgres.FeatureRepo, tileService *TileService) *FeatureService {
	return &FeatureService{
		featureRepo: featureRepo,
		tileService: tileService,
	}
}

func (s *FeatureService) GetAllByBBox(
	ctx context.Context,
	layerID string,
	minLon, minLat, maxLon, maxLat float64,
) ([]*domain.Feature, error) {
	return s.featureRepo.GetAllByBBox(ctx, layerID, minLon, minLat, maxLon, maxLat)
}

func (s *FeatureService) GetPublishedByBBox(
	ctx context.Context,
	layerID string,
	minLon, minLat, maxLon, maxLat float64,
) ([]*domain.Feature, error) {
	return s.featureRepo.GetPublishedByBBox(ctx, layerID, minLon, minLat, maxLon, maxLat)
}

func (s *FeatureService) GetByID(ctx context.Context, id int64) (*domain.Feature, error) {
	return s.featureRepo.GetByID(ctx, id)
}

func (s *FeatureService) GetPublishedByID(ctx context.Context, id int64) (*domain.Feature, error) {
	return s.featureRepo.GetPublishedByID(ctx, id)
}

func (s *FeatureService) Create(ctx context.Context, input *domain.CreateFeatureInput) (*domain.Feature, error) {
	f, err := s.featureRepo.Create(ctx, input)
	if err != nil {
		return nil, err
	}

	if s.tileService != nil {
		minLon, minLat, maxLon, maxLat := f.BBox()
		s.tileService.InvalidateCache(ctx, input.LayerID, input.MinZoom, input.MaxZoom,
			minLon, minLat, maxLon, maxLat)
	}

	return f, nil
}

func (s *FeatureService) Update(ctx context.Context, id int64, input *domain.UpdateFeatureInput) (*domain.Feature, error) {
	old, err := s.featureRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	f, err := s.featureRepo.Update(ctx, id, input)
	if err != nil {
		return nil, err
	}

	if s.tileService != nil {
		minZ := old.MinZoom
		maxZ := old.MaxZoom
		if input.MinZoom != nil {
			minZ = *input.MinZoom
		}
		if input.MaxZoom != nil {
			maxZ = *input.MaxZoom
		}
		minLon, minLat, maxLon, maxLat := f.BBox()
		s.tileService.InvalidateCache(ctx, old.LayerID, minZ, maxZ,
			minLon, minLat, maxLon, maxLat)
	}

	return f, nil
}

func (s *FeatureService) Delete(ctx context.Context, id int64) error {
	old, err := s.featureRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	err = s.featureRepo.Delete(ctx, id)
	if err != nil {
		return err
	}

	if s.tileService != nil {
		minLon, minLat, maxLon, maxLat := old.BBox()
		s.tileService.InvalidateCache(ctx, old.LayerID, old.MinZoom, old.MaxZoom,
			minLon, minLat, maxLon, maxLat)
	}

	return nil
}

func (s *FeatureService) ReplaceAll(ctx context.Context, layerID string, features []*domain.CreateFeatureInput) (int, error) {
	return s.featureRepo.ReplaceAll(ctx, layerID, features)
}

func (s *FeatureService) PublishFeature(ctx context.Context, id int64) error {
	return s.featureRepo.Publish(ctx, id)
}

func (s *FeatureService) PublishAll(ctx context.Context) error {
	return s.featureRepo.PublishAll(ctx)
}

func (s *FeatureService) GetNearbyPhotos(ctx context.Context, lon, lat, radius float64) ([]*domain.Feature, error) {
	return s.featureRepo.GetPublishedByBBox(ctx, "photos", lon-radius, lat-radius, lon+radius, lat+radius)
}

func (s *FeatureService) GetPannellumConfig(ctx context.Context, id int64) (*domain.Feature, error) {
	return s.featureRepo.GetPublishedByID(ctx, id)
}

func (s *FeatureService) GetMascotSkin(ctx context.Context, name string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"width":  200,
		"height": 200,
		"scale":  2,
		"color":  "#333333",
		"skin":   name,
	}, nil
}