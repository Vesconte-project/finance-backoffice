# Spy Signal Backoffice

Admin-only operational console (separate app) for analyst and data-ops workflows.

## Features

- Clerk-authenticated access
- Email allowlist admin authorization (`ADMIN_EMAIL_ALLOWLIST`)
- Analyst job creation (`ticker_snapshot`, `coverage_report`, `ticker_signal_v1`)
- Research experiment launch and inspection backed by `finance-backend` (`/research`)
- Job status polling and persisted result rendering
- Recent jobs history with failed-job retry
- Data inventory and entity-level coverage inspection (`/data`)
- Data Ops health calendar (`/data-ops`)
- Targeted rebuild/refill job submission + retry history
- Macro series upsert and release-calendar row upsert job forms
- Read-only registry / evidence inspection backed by `finance-backend` registry proxy routes (`/registry`)
- Live backend API contract inventory (`/contracts`)

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ADMIN_EMAIL_ALLOWLIST` (comma-separated, lowercase email list)
- `BACKEND_BASE_URL`
- `BACKEND_SERVICE_TOKEN` (required for authenticated backend research/admin calls)
- `CF_ACCESS_CLIENT_ID` (optional for local localhost dev, required when `finance-backend` is behind Cloudflare Access)
- `CF_ACCESS_CLIENT_SECRET` (optional for local localhost dev, required when `finance-backend` is behind Cloudflare Access)

## Boundaries

- `/research` launches and inspects orchestrated research experiments through `finance-backend`.
- `/registry` remains read-only inspection through `finance-backend` registry façade routes.
- Backoffice does not execute feature engineering, ML training, strategy construction, backtests, or orchestrator logic.
- Backoffice does not directly access backend Supabase tables, registry DB tables, or other internal databases.

## Canonical Finance API

Ticker-scoped finance data is resource-oriented and shared with the frontoffice:

- `GET /tickers/{ticker}/financial-statements`
- `GET /tickers/{ticker}/market-metrics`
- `GET /tickers/{ticker}/earnings-events` and `/latest`
- `GET /tickers/{ticker}/corporate-actions`
- `GET /tickers/{ticker}/filings`
- `GET /tickers/{ticker}/investor-events`
- `GET /tickers/{ticker}/guidance`
- `GET /tickers/{ticker}/equity-capital-events`
- `GET /tickers/{ticker}/fund-distributions`

Backoffice Next routes translate their existing `?symbol=` UI contract into these
canonical paths and authenticate upstream with `BACKEND_SERVICE_TOKEN`.
Cross-universe operational inventories use `/admin/data-control/*`; the global
rebalance explorer uses `/admin/fund-rebalances`. Deprecated `/analyst/*`
ticker-detail aliases are not consumed by this repository.

## Model Registry Views

The `/registry` area is read-only and consumes `finance-backend` registry proxy routes. It does not call the registry service directly from the backoffice.

Implemented views:

- registry dashboard and candidate list
- candidate detail and lineage
- bundle detail
- promotion history
- active pointer dashboard
- readiness report detail and latest candidate readiness

Useful local check:

```bash
BACKEND_BASE_URL=http://localhost:8001 BACKEND_SERVICE_TOKEN=local-dev-token npm run dev
```

Then open `/registry` while `finance-backend` is running with its registry façade enabled. If the backend reports `registry_unavailable`, the UI renders a safe unavailable state instead of attempting any direct registry access.

## Research Views

The `/research` area is an admin UI for launching and observing orchestrated research experiments through these backend routes:

- `POST /analyst/research/experiments`
- `GET /analyst/research/experiments`
- `GET /analyst/research/experiments/{experiment_id}`
- `GET /analyst/research/experiments/{experiment_id}/events`
- `GET /analyst/research/experiments/{experiment_id}/artifacts`

The browser never receives `BACKEND_SERVICE_TOKEN` directly. All research requests go through Next server route handlers in this repo.
When configured, those server-side research proxy handlers also attach `CF-Access-Client-Id` and `CF-Access-Client-Secret` for Cloudflare Access. If the Cloudflare vars are unset, the same research proxies still work for local development against an unprotected localhost backend.

## Data View

The `/data` page is an inventory-first operational view backed by these `finance-backend` routes:

- `GET /analyst/data-ops/inventory`
- `GET /analyst/data-ops/coverage`

It does not fall back to the legacy `/analyst/data-ops/health` contract. If the new contract is unavailable, the page renders a visible `Data Ops contract unavailable` state with the endpoint and status instead of showing guessed coverage.

## Development

```bash
npm install
npm run dev
```

### Backend contract validation

The Backoffice proxy check is intentionally one-way: every implemented Next.js
proxy must target a current backend operation intended for a UI consumer. It
does not require every backend operation to have a Backoffice proxy, because
many operations are frontoffice-only or worker-only.

```bash
FINANCE_BACKEND_CONTRACT_PATH=/path/to/finance-backend/docs/api-contract.json npm run test:backend-contract
```

### Local Clerk bypass

For local debugging with automation tools, Clerk can be bypassed by starting the dev server with:

```bash
ADMIN_AUTH_BYPASS=true npm run dev
```

This bypass is intentionally local-only. The code checks both conditions before skipping Clerk:

- `ADMIN_AUTH_BYPASS=true`
- `NODE_ENV !== 'production'`

That means a normal Vercel production deployment still requires Clerk even if `ADMIN_AUTH_BYPASS` is accidentally present in the environment. Do not add `ADMIN_AUTH_BYPASS` to Vercel production environment variables.

For agent/browser troubleshooting, see `AGENTS.md`. It documents the `ADMIN_AUTH_BYPASS=true npm run dev` flow, `agent-browser` install notes, screenshot/snapshot commands, error-overlay checks, and backend connectivity checks.

## Deployment

Deploy as a separate Vercel project/subdomain (example: `admin.yourdomain.com`) so admin tooling is isolated from the public app.

## CI/CD

This repo includes `.github/workflows/ci.yml`.
On every merge/push to `main`, it runs lint/build checks.
Production deployment should use native Vercel Git integration (no per-repo deploy tokens).

Recommended Vercel production environment variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `ADMIN_EMAIL_ALLOWLIST`
- `BACKEND_BASE_URL`
- `BACKEND_SERVICE_TOKEN`
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

Do not set `ADMIN_AUTH_BYPASS` in production. It is only for local `next dev`, and the app ignores it when `NODE_ENV=production`.

## Backend administrative JWT migration

`BACKOFFICE_AUTH_MODE=legacy` is the default during rollout. In that mode the
existing email allowlist and server credentials retain their behavior. Set
`BACKOFFICE_AUTH_MODE=clerk_jwt` only against a Backend containing migration
`007_administrative_rbac`, with `PLATFORM_API_ENABLED=true` and
`PLATFORM_ADMIN_ENABLED=true`.

In JWT mode Clerk provides session identity. `GET /v1/admin/me` verifies an
explicit, current PostgreSQL administrative grant before the backoffice renders
protected workspaces. Every Backend request uses the user's session JWT and the
native `/v1/admin` alias, with exact operation RBAC enforced by FastAPI.
Organization administrators do not receive platform administration. The email
allowlist, Clerk metadata, local bypass, shared secret and service token do not
grant native access. Unknown modes and unavailable authorization fail closed.

Configuration names: `BACKOFFICE_AUTH_MODE`, `BACKEND_BASE_URL`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. Use matching Clerk and
Backend environments; the backoffice's exact origin must be authorized by the
Backend's JWT configuration. Local example: `http://localhost:3101`, with the
Backend at `http://127.0.0.1:18095`. Never expose the Clerk secret key to the browser.
The `finance-infra/platform-local` profile provisions the administrative migration;
add the optional exact backoffice origin to its private input before starting it.

Create/revoke administrative grants only through the controlled Backend tool
documented in `finance-backend/docs/PLATFORM_ADMINISTRATIVE_RBAC.md`. No user HTTP
endpoint grants global rights. Roles require explicit operation permissions,
an audit reason, and expiry. No administrator identity is hardcoded here.

JWT requests omit cookies and legacy credentials, disable redirects and caching,
and retry a 401 once with a fresh default session token. Backend errors are
sanitized; native responses never fall back to service authentication. The
diagnostics health probe checks administrative identity in native mode.

Do not change Cloudflare or deploy from this work. Existing Cloudflare Access
policies must be reviewed by the operator before native traffic is enabled
outside local development. Keep legacy credentials until local, staging and
preview validation and rollback have been reviewed. Email display remains identity
information; it is not an authorization decision.

Tests now compile into repository-local ignored `.test-build/` rather than a
fixed `/tmp` location. Unit tests cover JWT-only headers, one refresh, invalid
modes, traversal rejection and mutation forwarding. Lint and production build
have also been exercised locally. A real administrative login/grant/revoke
proof remains required before cutover.

### Local native browser validation

Start the isolated stack from the sibling frontoffice with `npm run dev:platform`.
Its private inputs must authorize `http://localhost:3101`. In this checkout run
`npm run dev:platform` to open the backoffice at that exact loopback origin.
The launcher uses the sibling frontoffice's Clerk Development keys, verifies they
match the stack, and disables the legacy allowlist and bypass. It does not write
environment files or grant administrative access. Use the audited internal CLI
for a temporary, least-privilege grant.

For the automated real-session check, stop manually started Next.js processes
and run in `finance-frontoffice`:

```sh
PLATFORM_BACKOFFICE_QA=true npm run qa:platform -- --grep 'expiring explicit administrative grant'
```

Playwright owns both local Next.js servers. It verifies denial before the grant,
the granted interface and live contract, denial of an unrelated operation, and
denial after revocation. Grants expire and are revoked by the test; only its own
Development identities are removed. No screenshots, traces or videos store tokens.
