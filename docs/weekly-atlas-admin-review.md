# Weekly Atlas administration

Part of ENG-233. Draft companion to the backend weekly administration change.

The relationship-map page keeps its existing navigation and Frontier / Grow panel. Health and coverage now consume only the weekly response shapes at the existing administrative proxy routes. The frontier component and proxy route are unchanged.

Health reports the expected closed week and its calendar close against the latest published closed snapshot. It does not claim that a daily build ran or infer a Sunday timer result. Missing calendars and missing publications remain distinct states.

Coverage compares the current registered universe with nodes of the latest published closed week. No daily price freshness, legacy layer, or rolling-window filters remain. The current snapshot format has no per-company exclusion reasons, so the page says they were not recorded instead of inventing a price/history diagnosis. No publication means coverage is unavailable rather than zero coverage.

Legacy response shapes are rejected by the weekly parsers. An unavailable backend contract displays an error, with no fallback to legacy tables or fields. Deploy with the matching backend contract. Francisco reviews this backoffice branch before merging.

## Validation state

The Impeccable static detector reported no findings for the two changed components; `git diff --check` passed. The four parser tests, TypeScript validation, lint, build and visual review remain pending: Docker Desktop's WSL integration became unavailable after the credit interruption. Do not treat this branch as validated for merge. Tests executed for this backoffice change: 0.
