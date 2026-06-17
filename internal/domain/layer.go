package domain

import (
	"encoding/json"
	"time"
)

type Layer struct {
	ID          string
	Name        string
	Slug        string
	Description string
	Style       *json.RawMessage
	MinZoom     int
	MaxZoom     int
	IsPublic    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type CreateLayerInput struct {
	Name        string
	Slug        string
	Description string
	Style       *json.RawMessage
	MinZoom     int
	MaxZoom     int
	IsPublic    bool
}

type UpdateLayerInput struct {
	Name        *string
	Description *string
	Style       *json.RawMessage
	MinZoom     *int
	MaxZoom     *int
	IsPublic    *bool
}

type LayerListItem struct {
	ID           string
	Name         string
	Slug         string
	Description  string
	FeatureCount int
	UpdatedAt    time.Time
}