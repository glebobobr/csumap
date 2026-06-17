package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"csumap/internal/service"
)

type TileHandler struct {
	tileService *service.TileService
	baseURL     string
}

func NewTileHandler(tileService *service.TileService, baseURL string) *TileHandler {
	return &TileHandler{
		tileService: tileService,
		baseURL:     baseURL,
	}
}

func (h *TileHandler) ServeMVTTile(w http.ResponseWriter, r *http.Request) {
	layer := chi.URLParam(r, "layer")
	z, _ := strconv.Atoi(chi.URLParam(r, "z"))
	x, _ := strconv.Atoi(chi.URLParam(r, "x"))
	y, _ := strconv.Atoi(chi.URLParam(r, "y"))

	tile, err := h.tileService.GetTile(r.Context(), layer, z, x, y)
	if err != nil {
		http.Error(w, "tile error", http.StatusInternalServerError)
		return
	}

	writeTile(w, tile)
}

func (h *TileHandler) GetTileJSON(w http.ResponseWriter, r *http.Request) {
	layer := chi.URLParam(r, "layer")

	tileJSON, err := h.tileService.GetTileJSON(r.Context(), layer, h.baseURL)
	if err != nil {
		http.Error(w, "tilejson error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, tileJSON)
}

func writeTile(w http.ResponseWriter, data []byte) {
	w.Header().Set("Content-Type", "application/x-protobuf")
	w.Header().Set("Cache-Control", "max-age=3600")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if len(data) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}