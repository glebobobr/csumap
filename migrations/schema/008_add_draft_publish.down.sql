-- Migration 008: Rollback draft/publish pattern

-- Drop views
DROP VIEW IF EXISTS features_published;
DROP VIEW IF EXISTS features_draft;

-- Drop indexes
DROP INDEX IF EXISTS features_status_idx;
DROP INDEX IF EXISTS features_parent_id_idx;

-- Drop applied_changesets table
DROP TABLE IF EXISTS applied_changesets;

-- Remove columns from features
ALTER TABLE features
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS published_at,
    DROP COLUMN IF EXISTS published_by,
    DROP COLUMN IF EXISTS parent_id,
    DROP COLUMN IF EXISTS version;

-- Remove status from other tables
ALTER TABLE panoramas        DROP COLUMN IF EXISTS status;
ALTER TABLE photos           DROP COLUMN IF EXISTS status;
ALTER TABLE building_models  DROP COLUMN IF EXISTS status;

-- Drop enum type
DROP TYPE IF EXISTS edit_status;