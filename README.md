# Tamper-Evident Append-Only Log Service

This repository contains the backend submission for Potens Q1.
It is a backend-only API that stores audit logs in PostgreSQL and protects them with a SHA-256 hash chain.
If a stored row is edited later, verification fails.

## What the project does

The service stores append-only log entries with these fields:

- `actor`
- `action`
- `payload`
- `eventTime`
- `previousHash`
- `currentHash`

Each entry hashes the previous entry, so the chain becomes tamper-evident.
If anyone changes a historical row directly in the database, the hash chain breaks and `/verify` detects it.

This is a backend-only project. There is no UI requirement in the brief.

## Tech Stack

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Pino for logging
- Jest and Supertest for testing
- Docker Compose for optional local containerized Postgres

## Core idea

The chain is built from this input:

`previousHash | actor | action | canonicalPayload | eventTime`

The payload is canonicalized first so object key order does not change the hash.
That makes the system consistent even if payload data is sent in different orders.

## Endpoints

### Public

- `GET /health`
  - simple liveness check

### Protected with `x-api-key`

- `POST /log`
  - appends a new log entry
  - fields required: `actor`, `action`, `payload`
  - automatically creates `eventTime`, `previousHash`, and `currentHash`
  - rate limited to prevent abuse

- `GET /log/:id`
  - returns one entry
  - also returns whether the row’s own hash and chain link are valid

- `GET /verify`
  - walks the full chain from oldest to newest
  - returns `pass` if everything matches
  - returns `fail` with the first broken row if tampering is found

- `GET /export`
  - filtered JSON export
  - supports `from`, `to`, and `actor`

## File layout

- `src/index.ts`
  - Express app and route registration

- `src/db/client.ts`
  - Prisma client singleton

- `src/lib/auth.ts`
  - API key middleware

- `src/lib/hasher.ts`
  - canonical JSON hashing and SHA-256 logic

- `src/lib/verifier.ts`
  - chain verification and per-entry verification

- `src/lib/logger.ts`
  - Pino logger setup

- `src/routes/log.ts`
  - `POST /log` and `GET /log/:id`

- `src/routes/verify.ts`
  - `GET /verify`

- `src/routes/export.ts`
  - `GET /export`

- `src/cli/verify.ts`
  - standalone chain verification command

- `src/tests/log.test.ts`
  - automated tests covering hashing, auth, chaining, tamper detection, and export

- `prisma/schema.prisma`
  - database schema

- `prisma/migrations/`
  - checked-in migration history

## Database model

The `LogEntry` table stores:

- `id`
- `actor`
- `action`
- `payload`
- `eventTime`
- `previousHash`
- `currentHash`
- `createdAt`

Important design choice:

- `eventTime` is stored as a string so the exact value used in hashing round-trips without precision or timezone drift.

## How hashing works

When a new entry is created:

1. The app reads the latest row in the table.
2. It takes the latest row’s `currentHash` as the new entry’s `previousHash`.
3. It computes the new `currentHash` using SHA-256.
4. It inserts the new row into PostgreSQL.

If a historical row is modified later, the recomputed hash no longer matches the stored hash.
That is how tampering is detected.

## How verification works

`GET /verify` walks the chain in ID order.
For each row it checks two things:

1. Does `previousHash` match the previous row’s `currentHash`?
2. Does the stored `currentHash` equal the recomputed hash from the row data?

If either check fails, verification stops and returns the first broken row.

## Requirements covered from the brief

- append-only log entries
- SHA-256 hash chain
- `POST /log`
- `GET /log/:id`
- `GET /verify`
- `GET /export`
- API key auth
- rate limiting on POST
- structured logging
- checked-in migrations
- CLI verification command
- Docker support in the repo
- automated tests

## Setup

### 1. Configure environment

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Update `DATABASE_URL` in `.env` so it points to a real PostgreSQL instance.

### 2. Install dependencies

```powershell
npm install
```

### 3. Run migrations

```powershell
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start the server

```powershell
npm run dev
```

### 5. Open the health check

```text
http://localhost:3000/health
```

## How to test it locally

### Run the automated test suite

```powershell
npm test
```

### Run chain verification from the CLI

```powershell
npm run verify
```

### Create a log entry

```powershell
Invoke-WebRequest -Method Post -UseBasicParsing http://localhost:3000/log `
  -Headers @{ "x-api-key" = "potens-dev-key-change-in-production"; "Content-Type" = "application/json" } `
  -Body '{"actor":"alice","action":"login","payload":{"ip":"1.2.3.4"}}'
```

### Check verification

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/verify `
  -Headers @{ "x-api-key" = "potens-dev-key-change-in-production" }
```

## How to prove tamper detection

Use a direct database edit, not the API.

### Option 1: Prisma Studio

```powershell
npx prisma studio
```

Then:

1. Open the `logs` table.
2. Edit one existing row.
3. Change `action`, `actor`, or `payload`.
4. Save.
5. Run `GET /verify` again.

Expected result:

- `status` becomes `fail`
- `broken_id` points to the edited row
- `reason` is usually `hash_mismatch`

### Option 2: SQL

If you have direct DB access, update a row manually in PostgreSQL.
Then run `GET /verify` again.

## Example responses

### Health check

```json
{ "status": "ok", "time": "..." }
```

### Successful verification

```json
{ "status": "pass", "checked": 2 }
```

### Failed verification after tampering

```json
{ "status": "fail", "broken_id": 2, "reason": "hash_mismatch" }
```

## Docker

Docker files are included in the repo.
If Docker Desktop is available on your machine, you can use it to run PostgreSQL and the app.

If Docker is not available, use a local PostgreSQL installation instead.

## Testing notes

The test suite covers:

- SHA-256 hash determinism
- payload key order independence
- auth rejection
- chain linking across entries
- clean-chain verification
- tamper detection
- entry-level verification
- export filtering

## Security and design decisions

- API key auth is used because the brief allows a simple auth layer.
- Rate limiting is applied to `POST /log` to reduce abuse.
- Logging is structured with Pino.
- Canonical JSON hashing is used to keep hashes stable.
- Migrations are committed so the schema is reproducible.

## What is intentionally not included

- No frontend UI
- No browser homepage
- No in-memory database fallback
- No demo seed script
- No extra local helper scripts

These were removed to keep the submission focused on the required backend behavior.

## AI use log

- GitHub Copilot: used for TypeScript completion, Express wiring, Prisma query syntax, and quick implementation guidance
- ChatGPT: used for explaining the brief, reviewing the implementation, and helping with submission readiness

## Submission checklist

- [ ] PostgreSQL is running locally
- [ ] `npx prisma migrate dev --name init` succeeds
- [ ] `npm test` passes
- [ ] `npm run verify` passes
- [ ] GitHub repo is pushed and public
- [ ] Loom walkthrough is recorded
- [ ] Submission form is completed

## Final note

This project is backend-only and is meant to prove that the log chain is tamper-evident.
The most important demo is:

1. create two log entries
2. show they chain correctly
3. tamper with the database directly
4. show verification fails

That is the core of the assignment.
