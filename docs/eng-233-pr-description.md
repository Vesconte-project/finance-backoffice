# Use weekly Atlas administration in the backoffice

Part of ENG-233.

Replace daily-map source-health and layer/window coverage rendering with the weekly backend contract. The page shows expected calendar close against the latest published closed week and current registered-universe coverage. Missing publications, unavailable calendars and absent exclusion reasons are explicit; malformed or legacy payloads fail closed with no old-table fallback.

The Frontier / Grow component and its proxy route are unchanged. Navigation retains the existing styles and removes only obsolete daily-map query filters. Deploy with the separate weekly-administration backend contract. Francisco reviews the backoffice before merge.

At exactly 0bf6fbd: 62 tests passed, none failed or skipped; TypeScript, lint and npm run build passed in a clean python:3.12 container, non-root, no network and private TMPDIR 0700. Only existing locked dependencies and a generated public synthetic Clerk domain were used; no real credentials, data or production access. Recovery hashes/base are documented; the later commits add documentation only. Visual/product review remains Francisco's.

Keep draft. The agent does not merge, push main or create tags.
