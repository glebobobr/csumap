package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"csumap/internal/domain"
	"csumap/internal/service"
)

type AdminHandler struct {
	featureService *service.FeatureService
	layerService   *service.LayerService
}

func NewAdminHandler(featureService *service.FeatureService, layerService *service.LayerService) *AdminHandler {
	return &AdminHandler{
		featureService: featureService,
		layerService:   layerService,
	}
}

type ImportGeoJSONRequest struct {
	FeatureCollection json.RawMessage `json:"feature_collection"`
}

func (h *AdminHandler) ImportGeoJSON(w http.ResponseWriter, r *http.Request) {
	layerID := chi.URLParam(r, "layerID")

	var req ImportGeoJSONRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	var fc domain.FeatureCollection
	if err := json.Unmarshal(req.FeatureCollection, &fc); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	inputs := make([]*domain.CreateFeatureInput, len(fc.Features))
	for i, f := range fc.Features {
		var featureID *string
		if f.FeatureID != nil {
			featureID = f.FeatureID
		}
		name := ""
		if n, ok := f.Properties["name"].(string); ok {
			name = n
		}
		inputs[i] = &domain.CreateFeatureInput{
			LayerID:   layerID,
			FeatureID: featureID,
			Name:      name,
			Properties: f.Properties,
			Geometry:  f.Geometry,
			IsVisible: true,
			MinZoom:   0,
			MaxZoom:   22,
		}
	}

	count, err := h.featureService.ReplaceAll(r.Context(), layerID, inputs)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":    true,
		"count": count,
	})
}

func (h *AdminHandler) ExportGeoJSON(w http.ResponseWriter, r *http.Request) {
	layerID := chi.URLParam(r, "layerID")

	features, err := h.featureService.GetAllByBBox(r.Context(), layerID, -180, -90, 180, 90)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	collection := domain.NewFeatureCollection(features)
	respondJSON(w, http.StatusOK, collection.ToGeoJSON())
}

func (h *AdminHandler) GetAdminFeatures(w http.ResponseWriter, r *http.Request) {
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

func (h *AdminHandler) PublishFeature(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	if err := h.featureService.PublishFeature(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "published"})
}

func (h *AdminHandler) PublishAll(w http.ResponseWriter, r *http.Request) {
	if err := h.featureService.PublishAll(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "all drafts published"})
}