.PHONY: test-go test-js test-all coverage test-db-setup

# Run Go tests (unit + integration)
test-go:
	TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/geomap_test?sslmode=disable" go test ./... -v -count=1

# Run JavaScript tests
test-js:
	npm test

# Run all tests
test-all: test-db-setup test-go test-js

# Run coverage
coverage:
	go test ./... -coverprofile=coverage.out -covermode=count
	npm run coverage

# Create and migrate test database
test-db-setup:
	psql postgres://postgres:postgres@localhost:5432/postgres -c "CREATE DATABASE geomap_test;" 2>/dev/null || true
	psql postgres://postgres:postgres@localhost:5432/geomap_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
	CSUMAP_DATABASE_DSN="postgres://postgres:postgres@localhost:5432/geomap_test?sslmode=disable" go run ./cmd/migrate -path "file://migrations/schema"
