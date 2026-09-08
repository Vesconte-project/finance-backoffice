# Agent Runbook

## Company OS precedence

Before acting, read `franciscoabadesantos/company-os/AGENTS.md`. Company-level operating rules there govern this repository. If this repository conflicts with Company OS, stop and report the conflict rather than guessing or silently choosing the local rule.

Truth boundaries:
- Notion = Narrative / specs / rationale.
- Airtable V1 = governance, Snapshots, and authoritative AcceptanceEvents.
- Linear = work coordination only.
- GitHub = implementation, code, PRs, CI, and immutable technical evidence.

GitHub state, a merge, CI, deployment, or Linear status never creates or proves Acceptance.

This project is a Clerk-protected Next.js backoffice. For local debugging, agents may bypass Clerk only in development.

## Local Browser Debugging

Start the dev server with the local auth bypass:

```bash
ADMIN_AUTH_BYPASS=true npm run dev
```

The bypass is ignored when `NODE_ENV=production`, so production still requires Clerk.

Use the local URL printed by Next.js. It is usually:

```text
http://localhost:3000
```

If port 3000 is busy, Next.js may choose another port. Use the printed port.

## agent-browser

Use `agent-browser` to verify pages visually and inspect rendered content.

Install once if missing:

```bash
npm install -g agent-browser
agent-browser install
```

On Linux, if Chrome fails with missing shared libraries, run:

```bash
agent-browser install --with-deps
```

Basic verification flow for the Data tab:

```bash
agent-browser open 'http://localhost:3000/data?domain=market&entity=SPY&month=2026-06'
agent-browser wait --load networkidle
agent-browser screenshot --full
agent-browser snapshot -i
```

Some data-ops pages keep slow diagnostic requests open. If `networkidle` waits too long, use a fixed wait and inspect the page:

```bash
agent-browser wait 5000
agent-browser screenshot --full
agent-browser snapshot -i
```

Check for framework errors:

```bash
agent-browser eval 'document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay") ? "ERROR_OVERLAY" : "OK"'
agent-browser eval 'document.body.innerText.trim().length > 0 ? "HAS_CONTENT" : "BLANK"'
```

Close the browser when finished:

```bash
agent-browser close
```

## Backend Connectivity Checks

The backend is reached server-side from Next.js. For Cloudflare Access protected backends, `.env.local` must include:

```env
CF_ACCESS_CLIENT_ID=
CF_ACCESS_CLIENT_SECRET=
BACKEND_SERVICE_TOKEN=
BACKEND_BASE_URL=
```

Do not commit `.env.local`.

Quick backend health check from a loaded local env:

```bash
set -a
. ./.env.local
set +a

curl -i "$BACKEND_BASE_URL/health" \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
```

Expected result is `HTTP/2 200` with `{"status":"ok"}` or equivalent JSON.

## Data Ops Contract

The `/data` page uses the new backend contract only:

- `GET /analyst/data-ops/inventory`
- `GET /analyst/data-ops/coverage`

There is intentionally no fallback to `/analyst/data-ops/health`. If either new endpoint is missing, returns non-JSON, or returns an upstream error, the UI must show `Data Ops contract unavailable` instead of fabricated coverage.

When the live backend has not deployed these routes yet, verify the page with a temporary local mock backend that implements only the new endpoints, then start Next.js against it:

```bash
ADMIN_AUTH_BYPASS=true BACKEND_BASE_URL=http://localhost:8787 BACKEND_SERVICE_TOKEN=local-dev-token npm run dev
```

Do not commit mock fallback behavior into the app.

## Before Finishing

Run:

```bash
npm run lint
npm run build
```

If a dev server was started for verification, leave it running only when the user needs it. Otherwise stop it cleanly.
