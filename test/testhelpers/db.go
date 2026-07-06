package testhelpers

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/paulmach/orb"
	"github.com/paulmach/orb/geojson"

	"csumap/internal/domain"
	"csumap/internal/repository/postgres"
)

func TestDSN() string {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/geomap_test?sslmode=disable"
	}
	return dsn
}

func NewTestPool(ctx context.Context) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, TestDSN())
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return pool, nil
}

func NewTestDB(ctx context.Context) (*postgres.DB, error) {
	return postgres.New(ctx, &postgres.Config{
		DSN:             TestDSN(),
		MaxConns:        5,
		MinConns:        1,
		MaxConnLifetime: 0,
		MaxConnIdleTime: 0,
	})
}

func CleanTables(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, "DELETE FROM features")
	return err
}

func SeedLayer(ctx context.Context, pool *pgxpool.Pool, id, name, slug string) error {
	_, err := pool.Exec(ctx,
		`INSERT INTO layers (id, name, slug, description, is_public)
		 VALUES ($1, $2, $3, '', true)
		 ON CONFLICT (id) DO NOTHING`,
		id, name, slug,
	)
	return err
}

func SeedFeature(ctx context.Context, pool *pgxpool.Pool, layerID string, status string) (*domain.Feature, error) {
	geom := geojson.NewGeometry(orb.Point{37.62, 55.75})
	geomJSON, _ := geom.MarshalJSON()

	var f domain.Feature
	var geomResult []byte
	var propsJSON []byte
	var featureID *string

	err := pool.QueryRow(ctx,
		`INSERT INTO features (layer_id, name, properties, geometry, is_visible, min_zoom, max_zoom, status)
		 VALUES ($1, $2, '{}', ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), true, 0, 22, $4)
		 RETURNING id, layer_id, feature_id, name, properties,
		           ST_AsGeoJSON(geometry)::jsonb AS geometry,
		           is_visible, min_zoom, max_zoom, created_at, updated_at, status`,
		layerID, "test feature", string(geomJSON), status,
	).Scan(&f.ID, &f.LayerID, &featureID, &f.Name, &propsJSON, &geomResult,
		&f.IsVisible, &f.MinZoom, &f.MaxZoom, &f.CreatedAt, &f.UpdatedAt, &f.Status)

	if err != nil {
		return nil, fmt.Errorf("seed feature: %w", err)
	}

	f.FeatureID = featureID

	if len(geomResult) > 0 {
		g, err := geojson.UnmarshalGeometry(geomResult)
		if err == nil {
			f.Geometry = g.Geometry()
		}
	}

	return &f, nil
}
