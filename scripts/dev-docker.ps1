param()
Set-StrictMode -Version Latest

Write-Host "Starting postgres container..."
docker compose up -d postgres

Write-Host "Waiting for Postgres to become available..."
for ($i = 0; $i -lt 60; $i++) {
  try {
    $output = docker run --rm --network host postgres:16-alpine pg_isready -h localhost -p 5432 -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Postgres ready"
      break
    }
  } catch {
  }
  Start-Sleep -Seconds 1
}

Write-Host "Running Prisma migrate dev..."
npx prisma migrate dev --name init

Write-Host "Generating Prisma client..."
npx prisma generate

Write-Host "Starting app (build)..."
docker compose up --build
