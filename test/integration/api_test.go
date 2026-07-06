package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"csumap/internal/config"
	"csumap/internal/repository/postgres"
	"csumap/internal/service"
	httptransport "csumap/internal/transport/http"
	"csumap/internal/transport/http/handlers"
	"csumap/internal/transport/http/middleware"
	"csumap/test/testhelpers"
)

const (
	testJWTSecret = "test-secret"
)

func TestFullFlow_CreatePublishedDraftVisible(t *testing.T) {
	ctx := context.Background()
	db := testHelperDB(t, ctx)

	server := newTestServer(t, db)
	defer server.Close()

	layerID := testhelpers.TestLayerID
	if err := testhelpers.SeedLayer(ctx, db.Pool, layerID, testhelpers.TestLayerName, testhelpers.TestLayerSlug); err != nil {
		t.Fatalf("seed layer: %v", err)
	}

	token := generateTestJWT(t)

	publicURL := fmt.Sprintf("%s/api/v1/layers/%s/features", server.URL, layerID)
	adminURL := fmt.Sprintf("%s/api/v1/admin/layers/%s/features", server.URL, layerID)

	// 1. Verify public endpoint returns empty initially
	t.Log("Step 1: public endpoint returns empty")
	publicResp := getRequest(t, publicURL)
	if publicResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", publicResp.StatusCode)
	}
	assertEmptyFeatureCollection(t, publicResp)

	// 2. Create a feature via admin endpoint
	t.Log("Step 2: create feature via admin endpoint")
	featureJSON := `{"name":"integration test","geometry":{"type":"Point","coordinates":[37.62,55.75]},"properties":{},"is_visible":true,"min_zoom":0,"max_zoom":22}`
	createResp := postRequest(t, adminURL, token, featureJSON)
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", createResp.StatusCode)
	}
	var createdFeature map[string]interface{}
	if err := json.NewDecoder(createResp.Body).Decode(&createdFeature); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	props := createdFeature["properties"].(map[string]interface{})
	if props["status"] != "draft" {
		t.Fatalf("expected status=draft, got %v", props["status"])
	}

	// 3. Verify public endpoint still returns empty (draft is hidden)
	t.Log("Step 3: draft is hidden from public")
	publicResp2 := getRequest(t, publicURL)
	assertEmptyFeatureCollection(t, publicResp2)

	// 4. Publish all via admin endpoint
	t.Log("Step 4: publish all")
	publishURL := fmt.Sprintf("%s/api/v1/admin/features/publish-all", server.URL)
	publishResp := postRequest(t, publishURL, token, "")
	if publishResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", publishResp.StatusCode)
	}

	// 5. Verify public endpoint returns the feature now
	t.Log("Step 5: feature visible after publish")
	publicResp3 := getRequest(t, publicURL)
	if publicResp3.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", publicResp3.StatusCode)
	}
	var fc geojsonFeatureCollection
	if err := json.NewDecoder(publicResp3.Body).Decode(&fc); err != nil {
		t.Fatalf("decode public response: %v", err)
	}
	if len(fc.Features) != 1 {
		t.Fatalf("expected 1 feature, got %d", len(fc.Features))
	}
	if fc.Features[0].Properties["status"] != "published" {
		t.Fatalf("expected status=published, got %v", fc.Features[0].Properties["status"])
	}
}

type geojsonFeatureCollection struct {
	Type     string                   `json:"type"`
	Features []geojsonFeature         `json:"features"`
}

type geojsonFeature struct {
	ID         interface{}            `json:"id"`
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties"`
	Geometry   interface{}            `json:"geometry"`
}

func newTestServer(t *testing.T, db *postgres.DB) *httptest.Server {
	t.Helper()

	featureRepo := postgres.NewFeatureRepo(db)
	layerRepo := postgres.NewLayerRepo(db)

	featureService := service.NewFeatureService(featureRepo, nil)
	layerService := service.NewLayerService(layerRepo)

	featureHandler := handlers.NewFeatureHandler(featureService)
	layerHandler := handlers.NewLayerHandler(layerService)
	adminHandler := handlers.NewAdminHandler(featureService, layerService)
	authHandler := handlers.NewAuthHandler(&config.Config{
		JWT: config.JWTConfig{Secret: testJWTSecret},
	})
	authMiddleware := middleware.NewAuthMiddleware(testJWTSecret)

	router := httptransport.NewRouter(httptransport.RouterConfig{
		TileHandler:    nil,
		FeatureHandler: featureHandler,
		LayerHandler:   layerHandler,
		AdminHandler:   adminHandler,
		AuthHandler:    authHandler,
		AuthMiddleware: authMiddleware,
		Logger:         nil,
	})

	return httptest.NewServer(router)
}

func generateTestJWT(t *testing.T) string {
	t.Helper()

	claims := jwt.MapClaims{
		"sub": "test-user",
		"exp": time.Now().Add(1 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("sign jwt: %v", err)
	}
	return signed
}

func getRequest(t *testing.T, url string) *http.Response {
	t.Helper()
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	t.Cleanup(func() { resp.Body.Close() })
	return resp
}

func postRequest(t *testing.T, url, token, body string) *http.Response {
	t.Helper()
	var req *http.Request
	var err error
	if body != "" {
		req, err = http.NewRequest(http.MethodPost, url, bytes.NewReader([]byte(body)))
	} else {
		req, err = http.NewRequest(http.MethodPost, url, nil)
	}
	if err != nil {
		t.Fatalf("create POST request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST %s: %v", url, err)
	}
	t.Cleanup(func() { resp.Body.Close() })
	return resp
}

func assertEmptyFeatureCollection(t *testing.T, resp *http.Response) {
	t.Helper()
	var fc geojsonFeatureCollection
	if err := json.NewDecoder(resp.Body).Decode(&fc); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(fc.Features) != 0 {
		t.Fatalf("expected empty feature collection, got %d features", len(fc.Features))
	}
}

func testHelperDB(t *testing.T, ctx context.Context) *postgres.DB {
	t.Helper()

	db, err := testhelpers.NewTestDB(ctx)
	if err != nil {
		t.Fatalf("connect to test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	if err := testhelpers.CleanTables(ctx, db.Pool); err != nil {
		t.Fatalf("clean tables: %v", err)
	}

	return db
}
