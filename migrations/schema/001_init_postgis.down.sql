-- Migration 001: Rollback PostGIS initialization

DROP EXTENSION IF EXISTS postgis;
DROP EXTENSION IF EXISTS postgis_topology;
DROP EXTENSION IF EXISTS fuzzystrmatch;
DROP EXTENSION IF EXISTS postgis_tiger_geocoder;
DROP EXTENSION IF EXISTS "uuid-ossp";