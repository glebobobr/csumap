-- Migration 009: Add unique constraint on (layer_id, feature_id) for idempotent imports

CREATE UNIQUE INDEX IF NOT EXISTS features_layer_feature_id_unique 
ON features (layer_id, feature_id) 
WHERE feature_id IS NOT NULL;