# Tamper-Evident Append-Only Log Service

A cryptographically chained event log. Every entry stores a SHA-256 hash
that links to its predecessor. Any silent edit to a stored entry breaks the
chain, and `GET /verify` detects it.

Built with Node.js, Express, Prisma, and PostgreSQL.

## How to Run

### Option 1: Docker (one command)

```bash
cp .env.example .env
docker compose up --build
```

Visit `http://localhost:3000/health` to confirm it is running.

### Option 2: Local

```bash
cp .env.example .env
# Edit .env with your Postgres credentials

npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### Run tests

```bash
npm test
```

### CLI chain integrity check

```bash
npm run verify
```

## API

| Method | Endpoint               | Auth      | Description                                   |
|--------|------------------------|-----------|-----------------------------------------------|
| GET    | /health                | none      | Liveness check                                |
| POST   | /log                   | x-api-key | Append entry. Rate limited: 100/15 min        |
| GET    | /log/:id               | x-api-key | Entry plus self/link verification status      |
| GET    | /verify                | x-api-key | Full chain scan. Returns pass/fail + broken id|
| GET    | /export?from=&to=&actor= | x-api-key | Filtered JSON export                          |

## Example Requests

```bash
curl -X POST http://localhost:3000/log \
  -H "Content-Type: application/json" \
  -H "x-api-key: potens-dev-key-change-in-production" \
  -d '{"actor":"alice","action":"login","payload":{"ip":"1.2.3.4"}}'
```

```bash
curl http://localhost:3000/verify \
  -H "x-api-key: potens-dev-key-change-in-production"
```

```bash
curl "http://localhost:3000/export?actor=alice&from=2026-05-01T00:00:00Z" \
  -H "x-api-key: potens-dev-key-change-in-production"
```

## Design Decisions

**Canonical JSON hashing** — `computeHash` recursively sorts object keys before
hashing, so `{"b":1,"a":2}` and `{"a":2,"b":1}` produce identical hashes.
Without this, the same logical payload stored via different serializers would
produce different hashes and break chain verification.

**eventTime stored as TEXT** — Postgres TIMESTAMP can drift precision or
timezone when read back through Prisma. Storing as an ISO string means the
value round-trips bit-for-bit, which is critical because verification
recomputes hashes from stored values.

**previousHash stored explicitly** — auto-increment order alone is not
trustworthy as an audit boundary. The hash link is what makes the chain
tamper-evident.

**Prisma $transaction on POST** — `findFirst` and `create` are wrapped in a
transaction so two concurrent POSTs cannot both read the same `lastEntry` and
produce duplicate `previousHash` values.

**Rate limiting on POST only** — `/verify` and `/export` are read-only admin
operations. Rate limiting POST prevents log flooding by an untrusted client.

## What Works

- Append-only POST with SHA-256 chain linking
- Full chain verification at GET `/verify`
- Per-entry verification at GET `/log/:id`
- Tamper detection verified by direct DB mutation in tests
- Filtered export by actor and date range (ISO string comparison)
- Rate limiting: 100 POSTs per 15 minutes
- API key auth on all routes
- Pino structured logging with `pino-pretty` in development
- Database migrations checked in (`prisma/migrations/`)
- Docker + docker-compose one-command boot
- CLI: `npm run verify`
- 9 tests: hash determinism, key ordering, validation, auth, chain links,
  tamper detection, entry verification, export filtering

## What Is Unfinished (Stretch Goals)

**Merkle-tree batching** — Current `/verify` loads all entries and walks them
O(n). For 100k+ entries this slows down. The next step would be batching every
1,000 entries into a Merkle tree, storing roots per batch, and verifying roots
first so the happy path becomes O(batches).

**Streaming export** — Current `/export` loads all matching rows into memory.
A production version would use cursor-based pagination with a `cursor` query
param and `X-Next-Cursor` response header.

## Known Issue

The `$transaction` approach prevents the logical race condition in hash
ordering. However, at default READ COMMITTED isolation, extreme concurrent load
could still allow two transactions to read the same `lastEntry` before either
commits. A fully correct fix would require `SELECT ... FOR UPDATE` on the last
row or SERIALIZABLE isolation.

## AI Use Log

| Tool | Approx. tokens / suggestions | Used for |
|------|------------------------------|----------|
| GitHub Copilot | ~200 suggestions | TypeScript completion, Express wiring, Prisma query syntax, and repo implementation |
| Claude | Not used in this workspace session | Mentioned here only because the original build brief requested an honest AI-use log format |
