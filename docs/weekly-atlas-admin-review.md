# Weekly Atlas administration

Part of ENG-233. Draft companion to the backend weekly administration change.

The relationship-map page keeps its existing navigation and Frontier / Grow panel. Health and coverage now consume only the weekly response shapes at the existing administrative proxy routes. The frontier component and proxy route are unchanged.

Health reports the expected closed week and its calendar close against the latest published closed snapshot. It does not claim that a daily build ran or infer a Sunday timer result. Missing calendars and missing publications remain distinct states.

Coverage compares the current registered universe with nodes of the latest published closed week. No daily price freshness, legacy layer, or rolling-window filters remain. The current snapshot format has no per-company exclusion reasons, so the page says they were not recorded instead of inventing a price/history diagnosis. No publication means coverage is unavailable rather than zero coverage.

Legacy response shapes are rejected by the weekly parsers. An unavailable backend contract displays an error, with no fallback to legacy tables or fields. Deploy with the matching backend contract. Francisco reviews this backoffice branch before merging.

## Validation

At exactly `0bf6fbd96b613f62066797491c8f59fda6c2b8f9`: **62 tests passed, 0 failed, 0 skipped**. Full TypeScript, lint and `npm run build` passed in clean Python 3.12, non-root, no network and private TMPDIR 0700. The backoffice source was copied without .env/local credentials; installed dependencies matched the lockfile for Next, React, Clerk, TypeScript and ESLint. A public synthetic Clerk domain was generated only inside the test container. The static UI detector had no findings. Francisco's visual/product review remains required before merge.

[Recovery base, branch and SHA-256 of the five already committed files](eng-233-recovery-manifest.json). No backoffice archive extraction was needed; its uncommitted diff against 0bf6fbd was empty. The private recovery archives remain outside Git.

Merge gate: aguarda a reabertura do Vercel (ENG-196) e a primeira noite completa verificada, em coordenação com o backend. PR 3 só depois do PR 1; PR 4 só depois dos três em produção e de sete dias sem leituras. Estas condições de produção não foram verificadas pelo agente.
