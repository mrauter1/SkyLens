# Test Strategy

- Task ID: skylens-serverless-migration-and-equivalence-tas-1962bcf4
- Pair: test
- Phase ID: replace-server-runtime-surfaces
- Phase Directory Key: replace-server-runtime-surfaces
- Phase Title: Replace route handlers with browser-side services
- Scope: phase-local producer artifact

## Behavior-to-coverage map
- Config bootstrap without `/api/config`
  - `SkyLensServerless/tests/unit/config-contract.test.ts`
  - Covers locked `PublicConfig` shape and the browser-safe `NEXT_PUBLIC_SKYLENS_BUILD_VERSION` precedence path.
- Browser-side TLE provider without `/api/tle`
  - `SkyLensServerless/tests/unit/satellite-layer.test.ts`
  - Covers normalization, NORAD dedupe, ISS grouping, proxy URL construction, stale fallback, stale-window expiry, and viewer-facing contract parsing.
- Local health derivation without `/api/health`
  - `SkyLensServerless/tests/unit/health-route.test.ts`
  - Covers `empty`, `fresh`, and `stale` cache states through `fetchHealthStatus()`.
- Static-safe `/view` query handling
  - `SkyLensServerless/tests/unit/view-page.test.tsx`
  - Covers client-side `useSearchParams()` parsing into `ViewerRouteState`.
- No fork-local route handlers remain
  - `SkyLensServerless/tests/unit/bootstrap-standalone-fork.test.ts`
  - Covers absence of `app/api/config`, `app/api/health`, and `app/api/tle`.
- Viewer integration against browser-side services
  - `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
  - Covers settings-sheet health labels using local `fetchHealthStatus()` instead of route fetches.
- Permissions-policy/embed contract preservation
  - `SkyLensServerless/tests/unit/next-config.test.ts`
  - `SkyLensServerless/tests/e2e/embed.spec.ts`
  - Covers fork-local header emission and iframe permission delegation.

## Preserved invariants checked
- `PublicConfig`, `HealthApiResponse`, and `TleApiResponse` shapes remain unchanged for consumers.
- Satellite freshness windows stay at 6 hours fresh and 24 hours stale fallback.
- `/view` still accepts the same query-state vocabulary while building as static content.

## Edge cases and failure paths
- Upstream TLE refresh failures still return stale cache data within the stale window and hard-fail after expiry.
- Proxy URL construction remains deterministic for all three TLE source groups.
- Config build-version selection prefers the public env path needed by the client bundle when both env names are present.

## Flake-risk controls
- All added coverage is unit-level and deterministic.
- TLE behavior uses fixed fixtures, stubbed fetches, and fixed timestamps instead of live network access.
- `/view` parsing tests mock `useSearchParams()` directly instead of depending on router timing.

## Known gaps
- Phase-local tests document the selected TLE proxy path in assertions, but they do not verify third-party proxy availability.
- Aircraft live-data parity remains outside this phase’s scoped server-runtime replacement work.
