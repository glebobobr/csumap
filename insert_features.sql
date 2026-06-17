-- Общежитие (dormitory) - полигон
INSERT INTO features (layer_id, name, properties, geometry, status, is_visible, min_zoom, max_zoom)
VALUES (
    'buildings',
    'Общежитие №1',
    '{"type": "dormitory", "floors": 5, "color": "#8B4513"}'::jsonb,
    ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[61.3200,55.1780],[61.3215,55.1780],[61.3215,55.1790],[61.3200,55.1790],[61.3200,55.1780]]]}'), 4326),
    'published',
    true, 0, 22
),
(
    'buildings',
    'Общежитие №2',
    '{"type": "dormitory", "floors": 7, "color": "#8B4513"}'::jsonb,
    ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[61.3220,55.1785],[61.3235,55.1785],[61.3235,55.1795],[61.3220,55.1795],[61.3220,55.1785]]]}'), 4326),
    'published',
    true, 0, 22
),
(
    'zones',
    'Сад / Парк',
    '{"type": "garden", "color": "#228B22"}'::jsonb,
    ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[61.3180,55.1770],[61.3195,55.1770],[61.3195,55.1780],[61.3180,55.1780],[61.3180,55.1770]]]}'), 4326),
    'published',
    true, 0, 22
);