package postgres

import (
	"context"
	"fmt"
)

type TileRepo struct {
	db *DB
}

func NewTileRepo(db *DB) *TileRepo {
	return &TileRepo{db: db}
}

func (r *TileRepo) GetMVTTile(
	ctx context.Context,
	layerName string,
	z, x, y int,
) ([]byte, error) {

	query := `
		WITH
		bounds AS (
			SELECT ST_TileEnvelope($1, $2, $3) AS geom
		),
		mvt_data AS (
			SELECT
				f.id,
				f.name,
				f.properties,
				ST_AsMVTGeom(
					ST_Transform(f.geometry, 3857),
					bounds.geom,
					4096,
					256,
					true
				) AS geom
			FROM features f, bounds
			WHERE f.layer_id = $4
			  AND ST_Intersects(
					ST_Transform(f.geometry, 3857),
					bounds.geom
				  )
			  AND f.is_visible = true
			  AND f.min_zoom <= $1
			  AND f.max_zoom >= $1
		)
		SELECT ST_AsMVT(mvt_data.*, $4, 4096, 'geom', 'id')
		FROM mvt_data;
	`

	var tile []byte
	err := r.db.Pool.QueryRow(ctx, query, z, x, y, layerName).Scan(&tile)
	if err != nil {
		return nil, fmt.Errorf("get mvt tile z=%d x=%d y=%d: %w", z, x, y, err)
	}

	return tile, nil
}

func (r *TileRepo) GetTileJSON(ctx context.Context, layerName string) (*TileJSONData, error) {
	query := `
		SELECT
			l.id,
			l.name,
			l.min_zoom,
			l.max_zoom
		FROM layers l
		WHERE l.id = $1
	`

	var data TileJSONData
	err := r.db.Pool.QueryRow(ctx, query, layerName).Scan(
		&data.LayerID, &data.Name, &data.MinZoom, &data.MaxZoom,
	)
	if err != nil {
		return nil, fmt.Errorf("get layer for tilejson: %w", err)
	}

	return &data, nil
}

type TileJSONData struct {
	LayerID string
	Name    string
	MinZoom int
	MaxZoom int
}