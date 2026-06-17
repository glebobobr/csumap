CREATE TABLE layers (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    style       JSONB,
    min_zoom    INT DEFAULT 0,
    max_zoom    INT DEFAULT 22,
    is_public   BOOL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO layers (id, name, slug, description, min_zoom, max_zoom, is_public) VALUES
    ('buildings', 'Здания', 'buildings', 'Buildings layer', 0, 22, true),
    ('complex',   'Комплексы', 'complex', 'Building complexes', 0, 22, true),
    ('zones',     'Зоны', 'zones', 'Zoning areas', 0, 22, true),
    ('roads',     'Дороги', 'roads', 'Road network', 0, 22, true),
    ('poi',       'Точки интереса', 'poi', 'Points of interest', 0, 22, true),
    ('territory', 'Территория', 'territory', 'Territory boundaries', 0, 22, true)
ON CONFLICT (id) DO NOTHING;