# Test Strategy

- Task ID: skylensserverless-desktop-declutter-mobile-navig-bc222291
- Pair: test
- Phase ID: direct-tle-api
- Phase Directory Key: direct-tle-api
- Phase Title: Direct satellite API path
- Scope: phase-local producer artifact

## Behavior to coverage map

- Direct upstream default path
  - `SkyLensServerless/tests/unit/satellite-layer.test.ts`
  - Verifies the default fetch URLs are the three direct CelesTrak endpoints.
  - Verifies a blank `NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE` still falls back to direct upstream mode.

- Optional explicit relay-template compatibility
  - `SkyLensServerless/tests/unit/satellite-layer.test.ts`
  - Verifies a single configured relay template is applied to every group.
  - Verifies multi-template retry behavior after primary relay failure.
  - Verifies invalid relay templates fail fast before fetches start.

- Preserved cache / normalized contract invariants
  - `SkyLensServerless/tests/unit/satellite-layer.test.ts`
  - Verifies deduped satellite payload shape, 6-hour freshness window, 24-hour stale fallback window, and stale-window expiry behavior.
  - Verifies client catalog validation still returns the normalized ISS contract.

- Failure-path diagnostics
  - `SkyLensServerless/tests/unit/satellite-layer.test.ts`
  - Verifies direct upstream refresh failures emit structured request-path diagnostics.
  - Verifies direct no-cache failures expose request metadata without relay metadata fields.

- User-facing copy
  - `SkyLensServerless/tests/unit/config-contract.test.ts`
  - Verifies `PRIVACY_REASSURANCE_COPY` now states direct CelesTrak fetching.
  - `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - Verifies the live-startup reassurance panel shows the updated copy.
  - `SkyLensServerless/tests/e2e/landing.spec.ts`
  - Tracks the landing-page copy expectation for browser-level regression protection.

## Edge cases covered

- Empty/whitespace relay-template env config.
- Explicit relay-template omission of `{url}`.
- Upstream HTTP failure with no cache.
- Upstream refresh failure while stale cache is still eligible.

## Failure-path stabilization

- All transport tests stub `fetch` and resolve fixture bodies from deterministic local TLE fixtures.
- Cache-related tests reset local cache state before and after each case.
- No live network dependency is used in unit coverage.

## Known gaps

- `tests/e2e/landing.spec.ts` remains environment-dependent; local execution is blocked until Playwright browser binaries are installed.
