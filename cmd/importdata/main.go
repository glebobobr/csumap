package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
)

type Feature struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties"`
	Geometry   json.RawMessage        `json:"geometry"`
}

type FeatureCollection struct {
	Type     string     `json:"type"`
	Features []*Feature `json:"features"`
}

func main() {
	geojsonPath := flag.String("file", "campus-data.geojson", "Path to GeoJSON file")
	dbURL := flag.String("db", "", "Database URL (or use CSUMAP_DATABASE_DSN env)")
	flag.Parse()

	if *dbURL == "" {
		*dbURL = os.Getenv("CSUMAP_DATABASE_DSN")
	}
	if *dbURL == "" {
		*dbURL = os.Getenv("DATABASE_URL")
	}
	if *dbURL == "" {
		log.Fatal("Database URL required: set CSUMAP_DATABASE_DSN or use -db flag")
	}

	// Read GeoJSON file
	data, err := os.ReadFile(*geojsonPath)
	if err != nil {
		log.Fatalf("Failed to read GeoJSON: %v", err)
	}

	var fc FeatureCollection
	if err := json.Unmarshal(data, &fc); err != nil {
		log.Fatalf("Failed to parse GeoJSON: %v", err)
	}

	log.Printf("Loaded %d features from %s", len(fc.Features), *geojsonPath)

	// Connect to database
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, *dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer conn.Close(ctx)

	// Start transaction
	tx, err := conn.Begin(ctx)
	if err != nil {
		log.Fatalf("Failed to start transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	inserted := 0
	for _, f := range fc.Features {
		layerID := getLayerForFeature(f)
		if layerID == "" {
			log.Printf("Skipping feature %s: unknown layer", f.ID)
			continue
		}

		name := ""
		if n, ok := f.Properties["name"].(string); ok {
			name = n
		}

		// Marshal geometry back to JSON string
		geomJSON, err := json.Marshal(f.Geometry)
		if err != nil {
			log.Printf("Failed to marshal geometry for %s: %v", f.ID, err)
			continue
		}

		// Marshal properties
		propsJSON, err := json.Marshal(f.Properties)
		if err != nil {
			log.Printf("Failed to marshal properties for %s: %v", f.ID, err)
			continue
		}

		// Insert with status='published'
		_, err = tx.Exec(ctx, `
			INSERT INTO features (layer_id, feature_id, name, properties, geometry, is_visible, min_zoom, max_zoom, status)
			VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6, $7, $8, 'published')
			ON CONFLICT (layer_id, feature_id) DO UPDATE SET
				name = EXCLUDED.name,
				properties = EXCLUDED.properties,
				geometry = EXCLUDED.geometry,
				is_visible = EXCLUDED.is_visible,
				min_zoom = EXCLUDED.min_zoom,
				max_zoom = EXCLUDED.max_zoom,
				status = 'published',
				updated_at = NOW()
		`, layerID, f.ID, name, string(propsJSON), string(geomJSON), true, 0, 22)

		if err != nil {
			log.Printf("Failed to insert feature %s (%s): %v", f.ID, layerID, err)
			continue
		}
		inserted++
		log.Printf("Inserted: %s -> %s (%s)", f.ID, name, layerID)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("Failed to commit transaction: %v", err)
	}

	log.Printf("Successfully imported %d features", inserted)
}

func getLayerForFeature(f *Feature) string {
	props := f.Properties
	if props == nil {
		return ""
	}

	geomType := ""
	var geom map[string]interface{}
	if err := json.Unmarshal(f.Geometry, &geom); err == nil {
		if t, ok := geom["type"].(string); ok {
			geomType = t
		}
	}

	featureType := ""
	if t, ok := props["type"].(string); ok {
		featureType = t
	}

	complexID := ""
	if c, ok := props["complex_id"].(string); ok {
		complexID = c
	}

	// Polygon features
	if geomType == "Polygon" {
		if complexID != "" {
			return "complex"
		}
		buildingTypes := map[string]bool{
			"academic": true, "dormitory": true, "library": true,
			"sports": true, "admin": true, "canteen": true,
			"utility": true, "passage": true,
		}
		zoneTypes := map[string]bool{
			"garden": true, "lawn": true, "parking": true,
			"sports-ground": true, "construction": true,
		}
		if buildingTypes[featureType] {
			return "buildings"
		}
		if zoneTypes[featureType] {
			return "zones"
		}
		return "zones"
	}

	// LineString features
	if geomType == "LineString" {
		roadTypes := map[string]bool{
			"road": true, "sidewalk": true, "bike": true,
		}
		if roadTypes[featureType] {
			return "roads"
		}
		return "roads"
	}

	// Point features
	if geomType == "Point" {
		return "poi"
	}

	return ""
}