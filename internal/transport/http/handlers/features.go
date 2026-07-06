package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"csumap/internal/domain"
	"csumap/internal/service"
)

type FeatureHandler struct {
	featureService *service.FeatureService
}

func NewFeatureHandler(featureService *service.FeatureService) *FeatureHandler {
	return &FeatureHandler{featureService: featureService}
}

type GetFeaturesRequest struct {
	LayerID string  `json:"layer_id"`
	MinLon  float64 `json:"min_lon"`
	MinLat  float64 `json:"min_lat"`
	MaxLon  float64 `json:"max_lon"`
	MaxLat  float64 `json:"max_lat"`
}

func (h *FeatureHandler) GetPublicFeatures(w http.ResponseWriter, r *http.Request) {
	layerID := chi.URLParam(r, "layerID")

	minLon, _ := strconv.ParseFloat(r.URL.Query().Get("min_lon"), 64)
	minLat, _ := strconv.ParseFloat(r.URL.Query().Get("min_lat"), 64)
	maxLon, _ := strconv.ParseFloat(r.URL.Query().Get("max_lon"), 64)
	maxLat, _ := strconv.ParseFloat(r.URL.Query().Get("max_lat"), 64)

	if minLon == 0 && minLat == 0 && maxLon == 0 && maxLat == 0 {
		minLon, minLat, maxLon, maxLat = -180, -90, 180, 90
	}

	features, err := h.featureService.GetPublishedByBBox(r.Context(), layerID, minLon, minLat, maxLon, maxLat)
	if err != nil {
		log.Printf("GetPublicFeatures error: %v", err)
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	collection := domain.NewFeatureCollection(features)
	respondJSON(w, http.StatusOK, collection.ToGeoJSON())
}

func (h *FeatureHandler) GetAdminFeatures(w http.ResponseWriter, r *http.Request) {
	layerID := chi.URLParam(r, "layerID")

	minLon, _ := strconv.ParseFloat(r.URL.Query().Get("min_lon"), 64)
	minLat, _ := strconv.ParseFloat(r.URL.Query().Get("min_lat"), 64)
	maxLon, _ := strconv.ParseFloat(r.URL.Query().Get("max_lon"), 64)
	maxLat, _ := strconv.ParseFloat(r.URL.Query().Get("max_lat"), 64)

	if minLon == 0 && minLat == 0 && maxLon == 0 && maxLat == 0 {
		minLon, minLat, maxLon, maxLat = -180, -90, 180, 90
	}

	features, err := h.featureService.GetAllByBBox(r.Context(), layerID, minLon, minLat, maxLon, maxLat)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	collection := domain.NewFeatureCollection(features)
	respondJSON(w, http.StatusOK, collection.ToGeoJSON())
}

func (h *FeatureHandler) GetFeature(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

	feature, err := h.featureService.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}

	respondJSON(w, http.StatusOK, feature.ToGeoJSON())
}
func (h *FeatureHandler) GetNearbyPhotos(w http.ResponseWriter, r *http.Request) {
	lon, _ := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)

	radius := 500.0
	if rRadius := r.URL.Query().Get("radius"); rRadius != "" {
		if parsed, err := strconv.ParseFloat(rRadius, 64); err == nil {
			radius = parsed
		}
	}

	features, err := h.featureService.GetNearbyPhotos(r.Context(), lon, lat, radius)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	collection := domain.NewFeatureCollection(features)
	respondJSON(w, http.StatusOK, collection.ToGeoJSON())
}

func (h *FeatureHandler) GetPannellumConfig(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

	feature, err := h.featureService.GetPannellumConfig(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}

	// Генерируем конфигурацию Pannellum на основе фотографии
	config := map[string]interface{}{
		"type": "equirectangular",
		"panorama": feature.Properties["preview_url"],
		"hotSpotDebug": false,
	}

	respondJSON(w, http.StatusOK, config)
}

func (h *FeatureHandler) GetMascotSkin(w http.ResponseWriter, r *http.Request) {
	skinName := chi.URLParam(r, "name")

	config, err := h.featureService.GetMascotSkin(r.Context(), skinName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	respondJSON(w, http.StatusOK, config)
}

type CreateFeatureRequest struct {
	FeatureID  *string               `json:"feature_id,omitempty"`
	Name       string                `json:"name"`
	Properties map[string]interface{} `json:"properties"`
	Geometry   interface{}           `json:"geometry"`
	IsVisible  bool                  `json:"is_visible"`
	MinZoom    int                   `json:"min_zoom"`
	MaxZoom    int                   `json:"max_zoom"`
}

func (h *FeatureHandler) CreateFeature(w http.ResponseWriter, r *http.Request) {
	layerID := chi.URLParam(r, "layerID")

	var req CreateFeatureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	// DEBUG: Log the geometry
	log.Printf("DEBUG CreateFeature: req.Geometry type=%T, value=%+v", req.Geometry, req.Geometry)
	if req.Geometry != nil {
		geomBytes, _ := json.Marshal(req.Geometry)
		log.Printf("DEBUG CreateFeature: req.Geometry marshaled=%s", string(geomBytes))
	}

	geomData, err := json.Marshal(req.Geometry)
	if err != nil {
		respondError(w, http.StatusUnprocessableEntity, err)
		return
	}
	log.Printf("DEBUG CreateFeature: geomData=%s", string(geomData))
	
	geom, err := domain.ParseGeometry(geomData)
	if err != nil {
		log.Printf("DEBUG CreateFeature: ParseGeometry error=%v", err)
		respondError(w, http.StatusUnprocessableEntity, err)
		return
	}
	log.Printf("DEBUG CreateFeature: parsed geom=%+v", geom)

	input := &domain.CreateFeatureInput{
		LayerID:   layerID,
		FeatureID: req.FeatureID,
		Name:      req.Name,
		Properties: req.Properties,
		Geometry:  geom,
		IsVisible: req.IsVisible,
		MinZoom:   req.MinZoom,
		MaxZoom:   req.MaxZoom,
	}

	feature, err := h.featureService.Create(r.Context(), input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	respondJSON(w, http.StatusCreated, feature.ToGeoJSON())
}

type UpdateFeatureRequest struct {
	Name       *string                `json:"name,omitempty"`
	Properties map[string]interface{} `json:"properties,omitempty"`
	Geometry   interface{}            `json:"geometry,omitempty"`
	IsVisible  *bool                  `json:"is_visible,omitempty"`
	MinZoom    *int                   `json:"min_zoom,omitempty"`
	MaxZoom    *int                   `json:"max_zoom,omitempty"`
}

func (h *FeatureHandler) UpdateFeature(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		log.Printf("ERROR UpdateFeature: invalid id=%q: %v", idStr, err)
		respondError(w, http.StatusBadRequest, fmt.Errorf("invalid feature id: %q", idStr))
		return
	}

	var req UpdateFeatureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("ERROR UpdateFeature: decode body: %v", err)
		respondError(w, http.StatusBadRequest, err)
		return
	}

	log.Printf("DEBUG UpdateFeature: id=%d name=%v geometry=%v", id, req.Name, req.Geometry != nil)

	input := &domain.UpdateFeatureInput{
		Name:       req.Name,
		Properties: req.Properties,
		IsVisible:  req.IsVisible,
		MinZoom:    req.MinZoom,
		MaxZoom:    req.MaxZoom,
	}

	if req.Geometry != nil {
		geomData, err := json.Marshal(req.Geometry)
		if err != nil {
			log.Printf("ERROR UpdateFeature: marshal geometry: %v", err)
			respondError(w, http.StatusUnprocessableEntity, err)
			return
		}
		geom, err := domain.ParseGeometry(geomData)
		if err != nil {
			log.Printf("ERROR UpdateFeature: parse geometry: %v", err)
			respondError(w, http.StatusUnprocessableEntity, err)
			return
		}
		input.Geometry = geom
	}

	feature, err := h.featureService.Update(r.Context(), id, input)
	if err != nil {
		log.Printf("ERROR UpdateFeature: service.Update(%d): %v", id, err)
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	log.Printf("DEBUG UpdateFeature: success id=%d name=%q", feature.ID, feature.Name)
	respondJSON(w, http.StatusOK, feature.ToGeoJSON())
}

func (h *FeatureHandler) DeleteFeature(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)

	if err := h.featureService.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type ReplaceFeaturesRequest struct {
	Features []CreateFeatureRequest `json:"features"`
}

func (h *FeatureHandler) ReplaceFeatures(w http.ResponseWriter, r *http.Request) {
	layerID := chi.URLParam(r, "layerID")

	body, _ := io.ReadAll(r.Body)
	log.Printf("ReplaceFeatures request for layer %s: %s", layerID, string(body))
	
	var req ReplaceFeaturesRequest
	if err := json.Unmarshal(body, &req); err != nil {
		log.Printf("JSON decode error: %v", err)
		respondError(w, http.StatusBadRequest, err)
		return
	}

	inputs := make([]*domain.CreateFeatureInput, len(req.Features))
	for i, f := range req.Features {
		geomData, err := json.Marshal(f.Geometry)
		if err != nil {
			respondError(w, http.StatusUnprocessableEntity, err)
			return
		}
		geom, err := domain.ParseGeometry(geomData)
		if err != nil {
			respondError(w, http.StatusUnprocessableEntity, err)
			return
		}
		inputs[i] = &domain.CreateFeatureInput{
			LayerID:   layerID,
			FeatureID: f.FeatureID,
			Name:      f.Name,
			Properties: f.Properties,
			Geometry:  geom,
			IsVisible: f.IsVisible,
			MinZoom:   f.MinZoom,
			MaxZoom:   f.MaxZoom,
		}
	}

	count, err := h.featureService.ReplaceAll(r.Context(), layerID, inputs)
	if err != nil {
		log.Printf("ReplaceAll error for layer %s: %v", layerID, err)
		respondError(w, http.StatusInternalServerError, fmt.Errorf("replace failed: %w", err))
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":    true,
		"count": count,
	})
}