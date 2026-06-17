-- PostGIS schema for CSUMAP
-- Run: migrate -path migrations -database "postgres://postgres:postgres@localhost:5432/csumap" up

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";