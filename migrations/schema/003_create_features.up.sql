CREATE TABLE features (
    id          BIGSERIAL PRIMARY KEY,
    layer_id    VARCHAR(50) NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
    feature_id  VARCHAR(255),
    name        VARCHAR(255),
    properties  JSONB NOT NULL DEFAULT '{}',
    geometry    GEOMETRY(Geometry, 4326) NOT NULL,
    is_visible  BOOL DEFAULT true,
    min_zoom    INT DEFAULT 0,
    max_zoom    INT DEFAULT 22,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_features_layer ON features(layer_id);
CREATE INDEX IF NOT EXISTS idx_features_geometry ON features USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_features_properties ON features USING GIN (properties jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_features_layer_zoom ON features (layer_id, min_zoom, max_zoom);

CREATE TABLE backups (
    id              BIGSERIAL PRIMARY KEY,
    layer_id        VARCHAR(50) NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
    snapshot        JSONB NOT NULL,
    feature_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_layer ON backups(layer_id);
CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at DESC);