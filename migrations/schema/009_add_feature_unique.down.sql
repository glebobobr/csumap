-- Migration 009: Remove unique constraint on (layer_id, feature_id)

DROP INDEX IF EXISTS features_layer_feature_id_unique;