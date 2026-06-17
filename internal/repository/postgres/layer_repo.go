package postgres

import (
	"context"
	"encoding/json"
	"fmt"

	"csumap/internal/domain"
)

type LayerRepo struct {
	db *DB
}

func NewLayerRepo(db *DB) *LayerRepo {
	return &LayerRepo{db: db}
}

func (r *LayerRepo) List(ctx context.Context) ([]*domain.LayerListItem, error) {
	query := `
		SELECT
			l.id,
			l.name,
			l.slug,
			l.description,
			COUNT(f.id)::int AS feature_count,
			l.updated_at
		FROM layers l
		LEFT JOIN features f ON f.layer_id = l.id
		GROUP BY l.id, l.name, l.slug, l.description, l.updated_at
		ORDER BY l.id;
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query layers: %w", err)
	}
	defer rows.Close()

	var layers []*domain.LayerListItem
	for rows.Next() {
		var l domain.LayerListItem
		if err := rows.Scan(&l.ID, &l.Name, &l.Slug, &l.Description, &l.FeatureCount, &l.UpdatedAt); err != nil {
			return nil, err
		}
		layers = append(layers, &l)
	}
	return layers, rows.Err()
}

func (r *LayerRepo) GetByID(ctx context.Context, id string) (*domain.Layer, error) {
	query := `
		SELECT
			id, name, slug, description, style, min_zoom, max_zoom, is_public, created_at, updated_at
		FROM layers
		WHERE id = $1;
	`

	var l domain.Layer
	var styleJSON []byte
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&l.ID, &l.Name, &l.Slug, &l.Description, &styleJSON,
		&l.MinZoom, &l.MaxZoom, &l.IsPublic, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if len(styleJSON) > 0 {
		raw := json.RawMessage(styleJSON)
		l.Style = &raw
	}

	return &l, nil
}

func (r *LayerRepo) Create(ctx context.Context, input *domain.CreateLayerInput) (*domain.Layer, error) {
	var styleJSON []byte
	if input.Style != nil {
		var err error
		styleJSON, err = input.Style.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("marshal style: %w", err)
		}
	}

	query := `
		INSERT INTO layers (id, name, slug, description, style, min_zoom, max_zoom, is_public)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, name, slug, description, style, min_zoom, max_zoom, is_public, created_at, updated_at;
	`

	var l domain.Layer
	var returnedStyleJSON []byte
	err := r.db.Pool.QueryRow(ctx, query,
		input.Slug, input.Name, input.Slug, input.Description,
		styleJSON, input.MinZoom, input.MaxZoom, input.IsPublic,
	).Scan(
		&l.ID, &l.Name, &l.Slug, &l.Description, &returnedStyleJSON,
		&l.MinZoom, &l.MaxZoom, &l.IsPublic, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if len(returnedStyleJSON) > 0 {
		raw := json.RawMessage(returnedStyleJSON)
		l.Style = &raw
	}

	return &l, nil
}

func (r *LayerRepo) Update(ctx context.Context, id string, input *domain.UpdateLayerInput) (*domain.Layer, error) {
	setParts := []string{}
	args := []interface{}{id}
	argIdx := 2

	if input.Name != nil {
		setParts = append(setParts, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *input.Name)
		argIdx++
	}
	if input.Description != nil {
		setParts = append(setParts, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *input.Description)
		argIdx++
	}
	if input.Style != nil {
		styleJSON, err := json.Marshal(input.Style)
		if err != nil {
			return nil, fmt.Errorf("marshal style: %w", err)
		}
		setParts = append(setParts, fmt.Sprintf("style = $%d", argIdx))
		args = append(args, styleJSON)
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
	if input.IsPublic != nil {
		setParts = append(setParts, fmt.Sprintf("is_public = $%d", argIdx))
		args = append(args, *input.IsPublic)
		argIdx++
	}

	if len(setParts) == 0 {
		return r.GetByID(ctx, id)
	}

	setParts = append(setParts, "updated_at = NOW()")

	query := fmt.Sprintf(`
		UPDATE layers
		SET %s
		WHERE id = $1
		RETURNING id, name, slug, description, style, min_zoom, max_zoom, is_public, created_at, updated_at;
	`, joinStrings(setParts, ", "))

	var l domain.Layer
	var returnedStyleJSON []byte
	err := r.db.Pool.QueryRow(ctx, query, args...).Scan(
		&l.ID, &l.Name, &l.Slug, &l.Description, &returnedStyleJSON,
		&l.MinZoom, &l.MaxZoom, &l.IsPublic, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if len(returnedStyleJSON) > 0 {
		raw := json.RawMessage(returnedStyleJSON)
		l.Style = &raw
	}

	return &l, nil
}

func (r *LayerRepo) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM layers WHERE id = $1;`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func joinStrings(elems []string, sep string) string {
	if len(elems) == 0 {
		return ""
	}
	result := elems[0]
	for i := 1; i < len(elems); i++ {
		result += sep + elems[i]
	}
	return result
}