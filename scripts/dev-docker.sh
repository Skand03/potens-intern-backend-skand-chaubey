#!/usr/bin/env bash
set -euo pipefail

echo "Starting postgres container..."
docker compose up -d postgres

echo "Waiting for Postgres to become available..."
for i in {1..60}; do
  if docker run --rm --network host postgres:16-alpine pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
    echo "Postgres ready"
    break
  fi
  sleep 1
done

echo "Running Prisma migrate dev..."
npx prisma migrate dev --name init

echo "Generating Prisma client..."
npx prisma generate

echo "Starting app (build)..."
docker compose up --build
