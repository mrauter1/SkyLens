# Implementation Notes

- Task ID: skylensserverless-desktop-declutter-mobile-navig-bc222291
- Pair: implement
- Phase ID: direct-tle-api
- Phase Directory Key: direct-tle-api
- Phase Title: Direct satellite API path
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/lib/satellites/tle.ts`
- `SkyLensServerless/lib/config.ts`
- `SkyLensServerless/PARITY.md`
- `SkyLensServerless/tests/unit/satellite-layer.test.ts`
- `SkyLensServerless/tests/unit/config-contract.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/e2e/landing.spec.ts`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/out/` regenerated via `npm run build`

## Symbols touched
- `getTleApiResponse()`
- `fetchSatelliteCatalog()` in `lib/satellites/tle.ts`
- `TleGroupFetchError`
- `PRIVACY_REASSURANCE_COPY`
- `applyOrientationRetryResult()` call site in `viewer-shell.tsx`

## Checklist mapping
- Plan milestone 1: completed
  - Direct CelesTrak browser fetch is now the default transport.
  - Explicit `NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE` support remains optional and validated only when configured.
  - Privacy/parity copy and landing/viewer tests now describe direct upstream fetching.

## Assumptions
- Optional relay-template compatibility remains allowed when explicitly configured, per shared decisions.
- The `viewer-shell.tsx` nullability fix is acceptable as a validation unblocker because it does not alter the guarded runtime path.

## Preserved invariants
- TLE cache freshness window stays 6 hours.
- Stale fallback window stays 24 hours.
- Deduplication, stale-cache serving, and public `TLE data unavailable.` error behavior remain intact.

## Intended behavior changes
- Default satellite catalog requests go directly to the three CelesTrak group URLs.
- Failure diagnostics now include generic request metadata for the direct path while retaining relay metadata fields when relay templates are explicitly configured.
- User-facing privacy copy now says satellite catalogs are fetched directly from CelesTrak.

## Known non-changes
- Aircraft/OpenSky behavior was not changed.
- Relay-template parsing and retry behavior still exist when the env var is explicitly set.
- No mobile-navigation or desktop declutter work was performed in this phase.

## Expected side effects
- Regenerated `out/` artifacts now reflect the direct-fetch copy/transport changes.
- Export chunk filenames changed as part of the fresh static build output.

## Validation performed
- `npm ci`
- `./node_modules/.bin/vitest run tests/unit/satellite-layer.test.ts tests/unit/config-contract.test.ts --reporter=verbose`
- `./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts -t "keeps the viewer privacy reassurance copy visible before live startup begins" --reporter=verbose`
- `npm run build`
- `rg -n "corsproxy\\.io|browser-safe relay|fetches CelesTrak through" /workspace/SkyLens/SkyLensServerless -S`
- Attempted: `./node_modules/.bin/playwright test tests/e2e/landing.spec.ts --project=chromium`
  - Blocked by missing Playwright browser binary (`chromium_headless_shell` not installed).

## Deduplication / centralization decisions
- Kept direct-vs-relay branching local to `lib/satellites/tle.ts` so client callers and TLE schemas did not change.
