package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"csumap/internal/domain"
	"csumap/internal/service"
)

type LayerHandler struct {
	layerService *service.LayerService
}

func NewLayerHandler(layerService *service.LayerService) *LayerHandler {
	return &LayerHandler{layerService: layerService}
}

func (h *LayerHandler) ListLayers(w http.ResponseWriter, r *http.Request) {
	layers, err := h.layerService.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}
	respondJSON(w, http.StatusOK, layers)
}

func (h *LayerHandler) GetLayer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "layerID")

	layer, err := h.layerService.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}
	respondJSON(w, http.StatusOK, layer)
}

type CreateLayerRequest struct {
	Name        string          `json:"name"`
	Slug        string          `json:"slug"`
	Description string          `json:"description"`
	Style       json.RawMessage `json:"style,omitempty"`
	MinZoom     int             `json:"min_zoom"`
	MaxZoom     int             `json:"max_zoom"`
	IsPublic    bool            `json:"is_public"`
}

func (h *LayerHandler) CreateLayer(w http.ResponseWriter, r *http.Request) {
	var req CreateLayerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	var style *json.RawMessage
	if len(req.Style) > 0 {
		raw := json.RawMessage(req.Style)
		style = &raw
	}

	input := &domain.CreateLayerInput{
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		Style:       style,
		MinZoom:     req.MinZoom,
		MaxZoom:     req.MaxZoom,
		IsPublic:    req.IsPublic,
	}

	layer, err := h.layerService.Create(r.Context(), input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}
	respondJSON(w, http.StatusCreated, layer)
}

type UpdateLayerRequest struct {
	Name        *string          `json:"name,omitempty"`
	Description *string          `json:"description,omitempty"`
	Style       json.RawMessage  `json:"style,omitempty"`
	MinZoom     *int             `json:"min_zoom,omitempty"`
	MaxZoom     *int             `json:"max_zoom,omitempty"`
	IsPublic    *bool            `json:"is_public,omitempty"`
}

func (h *LayerHandler) UpdateLayer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "layerID")

	var req UpdateLayerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	var style *json.RawMessage
	if len(req.Style) > 0 {
		raw := json.RawMessage(req.Style)
		style = &raw
	}

	input := &domain.UpdateLayerInput{
		Name:        req.Name,
		Description: req.Description,
		Style:       style,
		MinZoom:     req.MinZoom,
		MaxZoom:     req.MaxZoom,
		IsPublic:    req.IsPublic,
	}

	layer, err := h.layerService.Update(r.Context(), id, input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}
	respondJSON(w, http.StatusOK, layer)
}

func (h *LayerHandler) DeleteLayer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "layerID")

	if err := h.layerService.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}