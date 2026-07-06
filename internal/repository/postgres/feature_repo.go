package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/paulmach/orb/geojson"

	"csumap/internal/domain"
)

type FeatureRepo struct {
	db *DB
}

func NewFeatureRepo(db *DB) *FeatureRepo {
	return &FeatureRepo{db: db}
}

func (r *FeatureRepo) GetPublishedByBBox(
	ctx context.Context,
	layerID string,
	minLon, minLat, maxLon, maxLat float64,
) ([]*domain.Feature, error) {

	query := `
		SELECT
			id,
			layer_id,
			feature_id,
			name,
			properties,
			ST_AsGeoJSON(geometry)::jsonb AS geometry,
			is_visible,
			min_zoom,
			max_zoom,
			created_at,
			updated_at,
			status
		FROM features
		WHERE layer_id = $1
		  AND geometry && ST_MakeEnvelope($2, $3, $4, $5, 4326)
		  AND ST_IsValid(geometry)
		  AND status = 'published'
		ORDER BY id;
	`

	rows, err := r.db.Pool.Query(ctx, query, layerID, minLon, minLat, maxLon, maxLat)
	if err != nil {
		return nil, fmt.Errorf("query features: %w", err)
	}
	defer rows.Close()

	return r.scanFeatures(rows)
}

func (r *FeatureRepo) GetAllByBBox(
	ctx context.Context,
	layerID string,
	minLon, minLat, maxLon, maxLat float64,
) ([]*domain.Feature, error) {

	query := `
		SELECT
			id,
			layer_id,
			feature_id,
			name,
			properties,
			ST_AsGeoJSON(geometry)::jsonb AS geometry,
			is_visible,
			min_zoom,
			max_zoom,
			created_at,
			updated_at,
			status
		FROM features
		WHERE layer_id = $1
		  AND geometry && ST_MakeEnvelope($2, $3, $4, $5, 4326)
		  AND ST_IsValid(geometry)
		ORDER BY id;
	`

	rows, err := r.db.Pool.Query(ctx, query, layerID, minLon, minLat, maxLon, maxLat)
	if err != nil {
		return nil, fmt.Errorf("query features: %w", err)
	}
	defer rows.Close()

	return r.scanFeatures(rows)
}

func (r *FeatureRepo) GetByID(ctx context.Context, id int64) (*domain.Feature, error) {
	query := `
		SELECT
			id,
			layer_id,
			feature_id,
			name,
			properties,
			ST_AsGeoJSON(geometry)::jsonb AS geometry,
			is_visible,
			min_zoom,
			max_zoom,
			created_at,
			updated_at,
			status
		FROM features
		WHERE id = $1;
	`

	row := r.db.Pool.QueryRow(ctx, query, id)
	return r.scanFeature(row)
}

func (r *FeatureRepo) GetPublishedByID(ctx context.Context, id int64) (*domain.Feature, error) {
	query := `
		SELECT
			id,
			layer_id,
			feature_id,
			name,
			properties,
			ST_AsGeoJSON(geometry)::jsonb AS geometry,
			is_visible,
			min_zoom,
			max_zoom,
			created_at,
			updated_at,
			status
		FROM features
		WHERE id = $1 AND status = 'published';
	`

	row := r.db.Pool.QueryRow(ctx, query, id)
	return r.scanFeature(row)
}

func (r *FeatureRepo) Create(ctx context.Context, input *domain.CreateFeatureInput) (*domain.Feature, error) {
	g := geojson.NewGeometry(input.Geometry)
	geomJSON, err := g.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("marshal geometry: %w", err)
	}

	propsJSON, err := json.Marshal(input.Properties)
	if err != nil {
		return nil, fmt.Errorf("marshal properties: %w", err)
	}

	query := `
		INSERT INTO features (layer_id, feature_id, name, properties, geometry, is_visible, min_zoom, max_zoom, status)
		VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6, $7, $8, 'draft')
		RETURNING
			id,
			layer_id,
			feature_id,
			name,
			properties,
			ST_AsGeoJSON(geometry)::jsonb AS geometry,
			is_visible,
			min_zoom,
			max_zoom,
			created_at,
			updated_at,
			status;
	`

	row := r.db.Pool.QueryRow(ctx, query,
		input.LayerID,
		input.FeatureID,
		input.Name,
		propsJSON,
		string(geomJSON),
		input.IsVisible,
		input.MinZoom,
		input.MaxZoom,
	)

	return r.scanFeature(row)
}

func (r *FeatureRepo) Update(ctx context.Context, id int64, input *domain.UpdateFeatureInput) (*domain.Feature, error) {
	setParts := []string{}
	args := []interface{}{id}
	argIdx := 2

	if input.Name != nil {
		setParts = append(setParts, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *input.Name)
		argIdx++
	}
	if input.Properties != nil {
		propsJSON, err := json.Marshal(input.Properties)
		if err != nil {
			return nil, fmt.Errorf("marshal properties: %w", err)
		}
		setParts = append(setParts, fmt.Sprintf("properties = $%d", argIdx))
		args = append(args, propsJSON)
		argIdx++
	}
	if input.Geometry != nil {
		g := geojson.NewGeometry(input.Geometry)
		geomJSON, err := g.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("marshal geometry: %w", err)
		}
		setParts = append(setParts, fmt.Sprintf("geometry = ST_SetSRID(ST_GeomFromGeoJSON($%d), 4326)", argIdx))
		args = append(args, string(geomJSON))
		argIdx++
	}
	if input.IsVisible != nil {
		setParts = append(setParts, fmt.Sprintf("is_visible = $%d", argIdx))
		args = append(args, *input.IsVisible)
		argIdx++
	}
	if input.MinZoom != nil {
		setParts = append(setParts, fmt.Sprintf("min_zoom = $%d", argIdx))
		args = append(args, *input.MinZoom)
		argIdx++
	}
	if input.MaxZoom != nil {
		setParts = append(setParts, fmt.Sprintf("max_zoom = $%d", argIdx))
		args = append(args, *input.MaxZoom)
		argIdx++
	}

	if len(setParts) == 0 {
		return r.GetByID(ctx, id)
	}

	setParts = append(setParts, "updated_at = NOW()")

	query := fmt.Sprintf(`
		UPDATE features
		SET %s
		WHERE id = $1
		RETURNING
			id,
			layer_id,
			feature_id,
			name,
			properties,
			ST_AsGeoJSON(geometry)::jsonb AS geometry,
			is_visible,
			min_zoom,
			max_zoom,
			created_at,
			updated_at,
			status;
	`, joinStrings(setParts, ", "))

	row := r.db.Pool.QueryRow(ctx, query, args...)
	return r.scanFeature(row)
}

// Publish - change status to published
func (r *FeatureRepo) Publish(ctx context.Context, id int64) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE features
		SET status = 'published', updated_at = NOW()
		WHERE id = $1
	`, id)
	return err
}

// PublishAll - change all draft to published
func (r *FeatureRepo) PublishAll(ctx context.Context) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE features
		SET status = 'published', updated_at = NOW()
		WHERE status = 'draft'
	`)
	return err
}

func (r *FeatureRepo) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM features WHERE id = $1;`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *FeatureRepo) ReplaceAll(ctx context.Context, layerID string, features []*domain.CreateFeatureInput) (int, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM features WHERE layer_id = $1 AND status = 'draft'`, layerID)
	if err != nil {
		return 0, fmt.Errorf("delete draft features: %w", err)
	}

	if len(features) == 0 {
		if err := tx.Commit(ctx); err != nil {
			return 0, fmt.Errorf("commit: %w", err)
		}
		return 0, nil
	}

	inserted := 0
	for _, f := range features {
		g := geojson.NewGeometry(f.Geometry)
		geomJSON, _ := g.MarshalJSON()
		propsJSON, _ := json.Marshal(f.Properties)

		_, err := tx.Exec(ctx, `
			INSERT INTO features (layer_id, feature_id, name, properties, geometry, is_visible, min_zoom, max_zoom, status)
			VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6, $7, $8, 'draft')
		`, f.LayerID, f.FeatureID, f.Name, propsJSON, string(geomJSON), f.IsVisible, f.MinZoom, f.MaxZoom)
		if err != nil {
			featureID := ""
			if f.FeatureID != nil {
				featureID = *f.FeatureID
			}
			log.Printf("Insert feature error (layer=%s, name=%s, feature_id=%s): %v", f.LayerID, f.Name, featureID, err)
			return 0, fmt.Errorf("insert feature: %w", err)
		}
		inserted++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit: %w", err)
	}

	return inserted, nil
}

func (r *FeatureRepo) scanFeatures(rows pgx.Rows) ([]*domain.Feature, error) {
	var features []*domain.Feature
	for rows.Next() {
		f, err := r.scanFeatureRow(rows)
		if err != nil {
			return nil, err
		}
		features = append(features, f)
	}
	return features, rows.Err()
}

func (r *FeatureRepo) scanFeature(row pgx.Row) (*domain.Feature, error) {
	return r.scanFeatureRow(row)
}

func (r *FeatureRepo) scanFeatureRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*domain.Feature, error) {
	var f domain.Feature
	var geomJSON []byte
	var propsJSON []byte
	var featureID *string

	err := scanner.Scan(
		&f.ID,
		&f.LayerID,
		&featureID,
		&f.Name,
		&propsJSON,
		&geomJSON,
		&f.IsVisible,
		&f.MinZoom,
		&f.MaxZoom,
		&f.CreatedAt,
		&f.UpdatedAt,
		&f.Status,
	)
	if err != nil {
		return nil, err
	}

	f.FeatureID = featureID

	if len(propsJSON) > 0 {
		json.Unmarshal(propsJSON, &f.Properties)
	}

	if len(geomJSON) > 0 {
		gjGeom, err := geojson.UnmarshalGeometry(geomJSON)
		if err != nil {
			return nil, fmt.Errorf("unmarshal geometry: %w", err)
		}
		// geojson.Geometry has a Geometry() method that returns orb.Geometry
		f.Geometry = gjGeom.Geometry()
	}

	return &f, nil
}