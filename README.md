# Spy Signal Backoffice

Admin-only operational console (separate app) for analyst and data-ops workflows.

## Funcionalidades

Sessões Clerk e RBAC administrativo atual no backend protegem a consola de
inventário, reparação de dados, contratos e operações de produção. O acesso a
research privado faz-se por exceção auditada a um recurso concreto.

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `BACKEND_BASE_URL`

## Contratos e privacidade

Os pedidos ao backend usam JWT de sessão e caminhos `/v1/admin/*`. As páginas de
dados usam `/v1/admin/tickers/{ticker}/...`, os inventários
`/v1/admin/data-control/*` e as operações `/v1/admin/ops/*`.
Não há allowlist, bypass local, segredo partilhado ou transporte de service token.

As vistas gerais de candidatos, bundles, readiness, evidência, avaliação e
experiências privadas são retiradas, incluindo BFF. Hoje só afeta dados de teste.
O regresso depende do contrato de conta dona e submissão explícita do registry
(ENG-197/ENG-203), fora deste corte. `/production` e o monitoring só mostram dados
comprovadamente de produção.

`/research` seleciona um recurso por ID e motivo obrigatório. O backend exige
permissão explícita e confirma auditoria durável antes de devolver conteúdo.
Não há listas, lotes, seleção por utilizador, watchlists ou alertas. Artefactos
concretos são transmitidos pelo BFF, sem URLs de armazenamento na resposta.

Com `PLATFORM_API_ENABLED=false`, a consola fica indisponível, sem fallback.
Nenhuma configuração, credencial, MFA ou grant de produção é alterada. O token
legado continua nas previews Vercel (ENG-186), mas o backend só o aceita no health
check temporário do mapa (ENG-228), sem poderes administrativos.

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

### Local authentication

Use Clerk Development sessions against the isolated synthetic platform profile.
Every request requires the user's session and a current explicit backend grant,
including local development. `npm run dev:platform` validates matching inputs.

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
- `BACKEND_BASE_URL`


## Backend administrative authentication

The backoffice always sends the user's default Clerk session JWT to canonical
`/v1/admin/*` routes. There is no authentication mode flag, email allowlist,
local bypass, shared secret or service-token transport. `/v1/admin/me` checks
`backoffice.access` before rendering protected workspaces; each operation checks
its exact internal backend permission again. Organization roles and commercial
subscriptions do not grant global administration. Current revocation/suspension
are enforced by the backend even with a valid JWT.

With PLATFORM_API_ENABLED=false the administrative console is unavailable.
The unavailable state has no privileged fallback. Activation is a separate
operator step; this change does not activate or grant anything in production.

Configuration: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY and
BACKEND_BASE_URL. The exact origin must be authorized by the backend. Local
origins remain http://localhost:3101 and http://127.0.0.1:18095. The controlled
backend CLI manages explicit expiring grants and audit reasons. No actor is
hardcoded and the Clerk Backend API is not called to authorize each request.
The displayed actor is the internal ID returned by the authorized backend.

Canonical examples: `/v1/admin/contracts`, `/v1/admin/data-control/coverage`,
`/v1/admin/ops/prefect/overview`. No duplicated `/admin/admin` paths. Requests
omit cookies, legacy headers and caching, reject redirects, and retry 401 once
with a refreshed session. Upstream errors never return response-body previews.
The operator reviews edge access separately before activation.

### Local native browser validation

Start the isolated stack from the sibling frontoffice with `npm run dev:platform`.
Its private inputs must authorize `http://localhost:3101`. In this checkout run
`npm run dev:platform` to open the backoffice at that exact loopback origin.
The launcher uses the sibling frontoffice's Clerk Development keys, verifies they
match the stack, and requires session authentication. It does not write
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

## Corte das leituras agregadas de watchlists (ENG-196)

Foram removidos os proxies `/api/frontoffice/watchlist/all-tickers` e
`/api/frontoffice/watchlist/subscriptions` e os painéis que os consumiam. As rotas
backend equivalentes e os espelhos `/v1/admin` são apagados no mesmo passo, sem
fallback ou substituição administrativa em lote. O backoffice não recebe a
identidade do job de alertas nem contactos dos seus destinatários.

Efeito em produção após merge: estes dois painéis deixam de existir e os proxies
retiram-se (404). As restantes rotas pessoais/admin são tratadas nos passos
seguintes. Não há alteração de MFA, RBAC, allowlist, credenciais ou configuração
de produção neste PR. O trabalho completo ENG-207 integra o passo de administração.

## Corte dos acessos pessoais

Retirados os proxies de watchlist por user_id e de runs AI, os formulários de
consulta por utilizador e a consulta de watchlists no painel inicial. O backoffice
não recebe um substituto para enumerar recursos privados. O acesso por exceção a
um recurso concreto será tratado no passo de administração, com motivo e auditoria.

Os PRs #9/#10 estão integrados. O corte funciona com /v1 desligado: estas vistas
mostram indisponibilidade e não recorrem ao service token para aceder aos dados
pessoais. Não ativa a plataforma nem altera credenciais. O Francisco faz o merge.
