#!/bin/sh
set -e

# Wait for database to be ready
until pg_isready -h db -U postgres; do
  echo "Waiting for database..."
  sleep 2
done

# Run migrations
echo "Running migrations..."
./migrate -direction up

# Import reference data if database is empty AND campus-data.geojson exists
echo "Checking if data needs to be imported..."
FEATURE_COUNT=$(psql "$CSUMAP_DATABASE_DSN" -t -c "SELECT COUNT(*) FROM features;")
FEATURE_COUNT=$(echo $FEATURE_COUNT | xargs)

if [ "$FEATURE_COUNT" -eq 0 ]; then
  if [ -f /app/campus-data.geojson ]; then
    echo "Database is empty, importing campus-data.geojson..."
    ./importdata -file /app/campus-data.geojson -db "$CSUMAP_DATABASE_DSN"
  else
    echo "Database is empty but no campus-data.geojson found. Static files will be used as fallback."
  fi
else
  echo "Database already has $FEATURE_COUNT features, skipping import."
fi

# Start server
exec ./csumap