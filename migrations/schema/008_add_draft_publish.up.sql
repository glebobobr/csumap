-- Migration 008: Add draft/publish pattern to features table
-- Adds status tracking, versioning, and published view for production API

-- Create enum type for edit status
CREATE TYPE edit_status AS ENUM (
    'draft',        -- локальное изменение, не видно на проде
    'review',       -- отправлено на проверку
    'published',    -- видно всем пользователям
    'archived'      -- скрыто, но не удалено
);

-- Add draft/publish columns to features table
ALTER TABLE features
    ADD COLUMN IF NOT EXISTS status        edit_status DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS published_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS published_by  BIGINT,
    ADD COLUMN IF NOT EXISTS parent_id     BIGINT REFERENCES features(id),
    ADD COLUMN IF NOT EXISTS version       INT DEFAULT 1;

-- Add status column to other editable tables
ALTER TABLE panoramas        ADD COLUMN IF NOT EXISTS status edit_status DEFAULT 'draft';
ALTER TABLE photos           ADD COLUMN IF NOT EXISTS status edit_status DEFAULT 'draft';
ALTER TABLE building_models  ADD COLUMN IF NOT EXISTS status edit_status DEFAULT 'draft';

-- VIEW for public API (only published features)
CREATE OR REPLACE VIEW features_published AS
    SELECT
        id,
        layer_id,
        feature_id,
        name,
        properties,
        geometry,
        is_visible,
        min_zoom,
        max_zoom,
        created_at,
        updated_at,
        status,
        published_at,
        published_by,
        parent_id,
        version
    FROM features
    WHERE status = 'published';

-- VIEW for draft features (editor use)
CREATE OR REPLACE VIEW features_draft AS
    SELECT
        id,
        layer_id,
        feature_id,
        name,
        properties,
        geometry,
        is_visible,
        min_zoom,
        max_zoom,
        created_at,
        updated_at,
        status,
        published_at,
        published_by,
        parent_id,
        version
    FROM features
    WHERE status IN ('draft', 'review');

-- Index for fast status filtering
CREATE INDEX IF NOT EXISTS features_status_idx ON features (status);
CREATE INDEX IF NOT EXISTS features_parent_id_idx ON features (parent_id);

-- Table to track applied changesets (for idempotent production deployment)
CREATE TABLE IF NOT EXISTS applied_changesets (
    id          UUID PRIMARY KEY,
    author      VARCHAR(255) NOT NULL,
    description TEXT,
    applied_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions on views (adjust role names as needed)
GRANT SELECT ON features_published TO PUBLIC;
GRANT SELECT ON features_draft TO PUBLIC;