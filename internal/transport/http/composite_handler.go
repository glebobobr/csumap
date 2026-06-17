// internal/transport/http/composite_handler.go
package http

import (
    "context"
    "net/http"
    "strconv"

    "github.com/go-chi/chi/v5"

    "csumap/internal/api"
    "csumap/internal/transport/http/handlers"
    "csumap/internal/transport/http/middleware"
    "go.uber.org/zap"
)

// CompositeHandler implements api.ServerInterface by delegating to individual handlers
type CompositeHandler struct {
    tileHandler    *handlers.TileHandler
    featureHandler *handlers.FeatureHandler
    layerHandler   *handlers.LayerHandler
    adminHandler   *handlers.AdminHandler
    authMiddleware *middleware.AuthMiddleware
    logger         *zap.Logger
}

func NewCompositeHandler(
    tileHandler *handlers.TileHandler,
    featureHandler *handlers.FeatureHandler,
    layerHandler *handlers.LayerHandler,
    adminHandler *handlers.AdminHandler,
    authMiddleware *middleware.AuthMiddleware,
    logger *zap.Logger,
) *CompositeHandler {
    return &CompositeHandler{
        tileHandler:    tileHandler,
        featureHandler: featureHandler,
        layerHandler:   layerHandler,
        adminHandler:   adminHandler,
        authMiddleware: authMiddleware,
        logger:         logger,
    }
}

// GetMVTTile implements api.ServerInterface
func (h *CompositeHandler) GetMVTTile(w http.ResponseWriter, r *http.Request, layer string, z int, x int, y int) {
    // Create a new request with URL parameters set for chi
    r2 := r.Clone(r.Context())
    r2.URL.Path = "/tiles/" + layer + "/" + strconv.Itoa(z) + "/" + strconv.Itoa(x) + "/" + strconv.Itoa(y) + ".mvt"
    // Set chi URL params
    ctx := chi.NewRouteContext()
    ctx.URLParams.Add("layer", layer)
    ctx.URLParams.Add("z", strconv.Itoa(z))
    ctx.URLParams.Add("x", strconv.Itoa(x))
    ctx.URLParams.Add("y", strconv.Itoa(y))
    r2 = r2.WithContext(context.WithValue(r2.Context(), chi.RouteCtxKey, ctx))
    h.tileHandler.ServeMVTTile(w, r2)
}

// GetTileJSON implements api.ServerInterface
func (h *CompositeHandler) GetTileJSON(w http.ResponseWriter, r *http.Request, layer string) {
    r2 := r.Clone(r.Context())
    r2.URL.Path = "/api/v1/tilejson/" + layer
    ctx := chi.NewRouteContext()
    ctx.URLParams.Add("layer", layer)
    r2 = r2.WithContext(context.WithValue(r2.Context(), chi.RouteCtxKey, ctx))
    h.tileHandler.GetTileJSON(w, r2)
}

// ListPhotos implements api.ServerInterface
func (h *CompositeHandler) ListPhotos(w http.ResponseWriter, r *http.Request, params api.ListPhotosParams) {
    // Set query parameters
    q := r.URL.Query()
    if params.Bbox != nil {
        q.Set("bbox", *params.Bbox)
    }
    if params.Limit != nil {
        q.Set("limit", strconv.Itoa(*params.Limit))
    }
    r2 := r.Clone(r.Context())
    r2.URL.RawQuery = q.Encode()
    r2.URL.Path = "/api/v1/layers/photos/features" // Use photos layer
    h.featureHandler.GetPublicFeatures(w, r2)
}

// GetNearbyPhotos implements api.ServerInterface
func (h *CompositeHandler) GetNearbyPhotos(w http.ResponseWriter, r *http.Request, params api.GetNearbyPhotosParams) {
    q := r.URL.Query()
    q.Set("lon", strconv.FormatFloat(float64(params.Lon), 'f', -1, 32))
    q.Set("lat", strconv.FormatFloat(float64(params.Lat), 'f', -1, 32))
    if params.Radius != nil {
        q.Set("radius", strconv.FormatFloat(float64(*params.Radius), 'f', -1, 32))
    }
    r2 := r.Clone(r.Context())
    r2.URL.RawQuery = q.Encode()
    r2.URL.Path = "/api/v1/photos/nearby"
    h.featureHandler.GetNearbyPhotos(w, r2)
}

// GetPhoto implements api.ServerInterface
func (h *CompositeHandler) GetPhoto(w http.ResponseWriter, r *http.Request, id int64) {
    r2 := r.Clone(r.Context())
    r2.URL.Path = "/api/v1/features/" + strconv.FormatInt(id, 10)
    ctx := chi.NewRouteContext()
    ctx.URLParams.Add("id", strconv.FormatInt(id, 10))
    r2 = r2.WithContext(context.WithValue(r2.Context(), chi.RouteCtxKey, ctx))
    h.featureHandler.GetFeature(w, r2)
}

// GetNearestPanoramas implements api.ServerInterface
func (h *CompositeHandler) GetNearestPanoramas(w http.ResponseWriter, r *http.Request, params api.GetNearestPanoramasParams) {
    q := r.URL.Query()
    q.Set("lon", strconv.FormatFloat(float64(params.Lon), 'f', -1, 32))
    q.Set("lat", strconv.FormatFloat(float64(params.Lat), 'f', -1, 32))
    if params.Radius != nil {
        q.Set("radius", strconv.FormatFloat(float64(*params.Radius), 'f', -1, 32))
    }
    r2 := r.Clone(r.Context())
    r2.URL.RawQuery = q.Encode()
    r2.URL.Path = "/api/v1/panoramas/nearest"
    h.featureHandler.GetNearbyPhotos(w, r2)
}

// GetPannellumConfig implements api.ServerInterface
func (h *CompositeHandler) GetPannellumConfig(w http.ResponseWriter, r *http.Request, id int64) {
    r2 := r.Clone(r.Context())
    r2.URL.Path = "/api/v1/panoramas/" + strconv.FormatInt(id, 10) + "/config"
    ctx := chi.NewRouteContext()
    ctx.URLParams.Add("id", strconv.FormatInt(id, 10))
    r2 = r2.WithContext(context.WithValue(r2.Context(), chi.RouteCtxKey, ctx))
    h.featureHandler.GetPannellumConfig(w, r2)
}

// GetMascotSkin implements api.ServerInterface
func (h *CompositeHandler) GetMascotSkin(w http.ResponseWriter, r *http.Request, name string) {
    r2 := r.Clone(r.Context())
    r2.URL.Path = "/api/v1/mascot/skins/" + name
    ctx := chi.NewRouteContext()
    ctx.URLParams.Add("name", name)
    r2 = r2.WithContext(context.WithValue(r2.Context(), chi.RouteCtxKey, ctx))
    h.featureHandler.GetMascotSkin(w, r2)
}
