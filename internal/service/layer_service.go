package service

import (
	"context"

	"csumap/internal/domain"
	"csumap/internal/repository/postgres"
)

type LayerService struct {
	layerRepo *postgres.LayerRepo
}

func NewLayerService(layerRepo *postgres.LayerRepo) *LayerService {
	return &LayerService{layerRepo: layerRepo}
}

func (s *LayerService) List(ctx context.Context) ([]*domain.LayerListItem, error) {
	return s.layerRepo.List(ctx)
}

func (s *LayerService) GetByID(ctx context.Context, id string) (*domain.Layer, error) {
	return s.layerRepo.GetByID(ctx, id)
}

func (s *LayerService) Create(ctx context.Context, input *domain.CreateLayerInput) (*domain.Layer, error) {
	return s.layerRepo.Create(ctx, input)
}

func (s *LayerService) Update(ctx context.Context, id string, input *domain.UpdateLayerInput) (*domain.Layer, error) {
	return s.layerRepo.Update(ctx, id, input)
}

func (s *LayerService) Delete(ctx context.Context, id string) error {
	return s.layerRepo.Delete(ctx, id)
}