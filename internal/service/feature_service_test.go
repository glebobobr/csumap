package service

import (
	"context"
	"testing"

	"github.com/paulmach/orb"

	"csumap/internal/domain"
	"csumap/internal/repository/postgres"
	"csumap/test/testhelpers"
)

func TestFeatureService_Create(t *testing.T) {
	ctx := context.Background()
	db := testHelperDB(t, ctx)

	featureRepo := postgres.NewFeatureRepo(db)
	svc := NewFeatureService(featureRepo, nil)

	layerID := testhelpers.TestLayerID
	if err := testhelpers.SeedLayer(ctx, db.Pool, layerID, testhelpers.TestLayerName, testhelpers.TestLayerSlug); err != nil {
		t.Fatalf("seed layer: %v", err)
	}

	input := &domain.CreateFeatureInput{
		LayerID:   layerID,
		Name:      "created feature",
		MinZoom:   0,
		MaxZoom:   22,
		IsVisible: true,
		Geometry:  pointGeometry(),
	}

	f, err := svc.Create(ctx, input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if f.ID == 0 {
		t.Fatal("expected non-zero id")
	}
	if f.Status != "draft" {
		t.Fatalf("expected status=draft, got %q", f.Status)
	}
	if f.Name != "created feature" {
		t.Fatalf("expected name=created feature, got %q", f.Name)
	}
}

func TestFeatureService_GetPublishedByBBox_OnlyPublished(t *testing.T) {
	ctx := context.Background()
	db := testHelperDB(t, ctx)

	featureRepo := postgres.NewFeatureRepo(db)
	svc := NewFeatureService(featureRepo, nil)

	layerID := testhelpers.TestLayerID
	if err := testhelpers.SeedLayer(ctx, db.Pool, layerID, testhelpers.TestLayerName, testhelpers.TestLayerSlug); err != nil {
		t.Fatalf("seed layer: %v", err)
	}

	draft, err := testhelpers.SeedFeature(ctx, db.Pool, layerID, testhelpers.StatusDraft)
	if err != nil {
		t.Fatalf("seed draft feature: %v", err)
	}
	published, err := testhelpers.SeedFeature(ctx, db.Pool, layerID, testhelpers.StatusPublished)
	if err != nil {
		t.Fatalf("seed published feature: %v", err)
	}

	results, err := svc.GetPublishedByBBox(ctx, layerID, -180, -90, 180, 90)
	if err != nil {
		t.Fatalf("GetPublishedByBBox: %v", err)
	}

	for _, r := range results {
		if r.Status != "published" {
			t.Errorf("expected only published features, got status=%q for id=%d", r.Status, r.ID)
		}
	}

	foundDraft := false
	foundPublished := false
	for _, r := range results {
		if r.ID == draft.ID {
			foundDraft = true
		}
		if r.ID == published.ID {
			foundPublished = true
		}
	}
	if foundDraft {
		t.Error("draft feature should not be returned by GetPublishedByBBox")
	}
	if !foundPublished {
		t.Error("published feature should be returned by GetPublishedByBBox")
	}
}

func TestFeatureService_PublishAll(t *testing.T) {
	ctx := context.Background()
	db := testHelperDB(t, ctx)

	featureRepo := postgres.NewFeatureRepo(db)
	svc := NewFeatureService(featureRepo, nil)

	layerID := testhelpers.TestLayerID
	if err := testhelpers.SeedLayer(ctx, db.Pool, layerID, testhelpers.TestLayerName, testhelpers.TestLayerSlug); err != nil {
		t.Fatalf("seed layer: %v", err)
	}

	f1, err := testhelpers.SeedFeature(ctx, db.Pool, layerID, testhelpers.StatusDraft)
	if err != nil {
		t.Fatalf("seed draft feature 1: %v", err)
	}
	f2, err := testhelpers.SeedFeature(ctx, db.Pool, layerID, testhelpers.StatusDraft)
	if err != nil {
		t.Fatalf("seed draft feature 2: %v", err)
	}

	if err := svc.PublishAll(ctx); err != nil {
		t.Fatalf("PublishAll: %v", err)
	}

	for _, id := range []int64{f1.ID, f2.ID} {
		f, err := svc.GetByID(ctx, id)
		if err != nil {
			t.Fatalf("GetByID(%d): %v", id, err)
		}
		if f.Status != "published" {
			t.Errorf("expected feature %d status=published, got %q", id, f.Status)
		}
	}
}

func TestFeatureService_GetAllByBBox_IncludesDrafts(t *testing.T) {
	ctx := context.Background()
	db := testHelperDB(t, ctx)

	featureRepo := postgres.NewFeatureRepo(db)
	svc := NewFeatureService(featureRepo, nil)

	layerID := testhelpers.TestLayerID
	if err := testhelpers.SeedLayer(ctx, db.Pool, layerID, testhelpers.TestLayerName, testhelpers.TestLayerSlug); err != nil {
		t.Fatalf("seed layer: %v", err)
	}

	draft, err := testhelpers.SeedFeature(ctx, db.Pool, layerID, testhelpers.StatusDraft)
	if err != nil {
		t.Fatalf("seed draft feature: %v", err)
	}
	published, err := testhelpers.SeedFeature(ctx, db.Pool, layerID, testhelpers.StatusPublished)
	if err != nil {
		t.Fatalf("seed published feature: %v", err)
	}

	results, err := svc.GetAllByBBox(ctx, layerID, -180, -90, 180, 90)
	if err != nil {
		t.Fatalf("GetAllByBBox: %v", err)
	}

	foundDraft := false
	foundPublished := false
	for _, r := range results {
		if r.ID == draft.ID {
			foundDraft = true
		}
		if r.ID == published.ID {
			foundPublished = true
		}
	}
	if !foundDraft {
		t.Error("expected draft feature in GetAllByBBox results")
	}
	if !foundPublished {
		t.Error("expected published feature in GetAllByBBox results")
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

func pointGeometry() orb.Geometry {
	return orb.Point{37.62, 55.75}
}
