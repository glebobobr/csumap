package domain

import (
	"time"

	"github.com/paulmach/orb"
	"github.com/paulmach/orb/geojson"
)

type Feature struct {
	ID         int64
	LayerID    string
	FeatureID  *string
	Name       string
	Properties map[string]interface{}
	Geometry   orb.Geometry
	IsVisible  bool
	MinZoom    int
	MaxZoom    int
	CreatedAt  time.Time
	UpdatedAt  time.Time
	Status     string
}

func (f *Feature) ToGeoJSON() *geojson.Feature {
	gj := geojson.NewFeature(f.Geometry)
	if f.ID != 0 {
		gj.ID = f.ID
	} else if f.FeatureID != nil {
		gj.ID = *f.FeatureID
	}
	if f.Name != "" {
		gj.Properties["name"] = f.Name
	}
	for k, v := range f.Properties {
		gj.Properties[k] = v
	}
	if f.Status != "" {
		gj.Properties["status"] = f.Status
	}
	return gj
}

func (f *Feature) BBox() (minLon, minLat, maxLon, maxLat float64) {
	if f.Geometry == nil {
		return -180, -90, 180, 90
	}
	b := f.Geometry.Bound()
	return b.Min.X(), b.Min.Y(), b.Max.X(), b.Max.Y()
}

func ParseGeometry(data []byte) (orb.Geometry, error) {
	g, err := geojson.UnmarshalGeometry(data)
	if err != nil {
		return nil, err
	}
	return g.Geometry(), nil
}

type CreateFeatureInput struct {
	LayerID    string
	FeatureID  *string
	Name       string
	Properties map[string]interface{}
	Geometry   orb.Geometry
	IsVisible  bool
	MinZoom    int
	MaxZoom    int
}

type UpdateFeatureInput struct {
	Name       *string
	Properties map[string]interface{}
	Geometry   orb.Geometry
	IsVisible  *bool
	MinZoom    *int
	MaxZoom    *int
}

type FeatureCollection struct {
	Type     string
	Features []*Feature
}

func NewFeatureCollection(features []*Feature) *FeatureCollection {
	return &FeatureCollection{
		Type:     "FeatureCollection",
		Features: features,
	}
}

func (fc *FeatureCollection) ToGeoJSON() *geojson.FeatureCollection {
	gjFeatures := make([]*geojson.Feature, len(fc.Features))
	for i, f := range fc.Features {
		gjFeatures[i] = f.ToGeoJSON()
	}
	fcGeoJSON := geojson.NewFeatureCollection()
	fcGeoJSON.Features = gjFeatures
	return fcGeoJSON
}