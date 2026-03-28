# Implementation Notes

- Task ID: skylens-serverless-migration-and-equivalence-tas-1962bcf4
- Pair: implement
- Phase ID: replace-server-runtime-surfaces
- Phase Directory Key: replace-server-runtime-surfaces
- Phase Title: Replace route handlers with browser-side services
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/app/view/page.tsx`
- `SkyLensServerless/app/view/view-page-client.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/config.ts`
- `SkyLensServerless/lib/health/client.ts`
- `SkyLensServerless/lib/satellites/client.ts`
- `SkyLensServerless/lib/satellites/tle.ts`
- `SkyLensServerless/tests/unit/bootstrap-standalone-fork.test.ts`
- `SkyLensServerless/tests/unit/config-contract.test.ts`
- `SkyLensServerless/tests/unit/health-route.test.ts`
- `SkyLensServerless/tests/unit/satellite-layer.test.ts`
- `SkyLensServerless/tests/unit/view-page.test.tsx`
- `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
- deleted: `SkyLensServerless/app/api/config/route.ts`
- deleted: `SkyLensServerless/app/api/health/route.ts`
- deleted: `SkyLensServerless/app/api/tle/route.ts`

## Symbols touched
- `getPublicConfig`
- `fetchHealthStatus`
- `fetchSatelliteCatalog`
- `getTleApiResponse`
- `getTleCacheHealth`
- `resetTleCacheForTests`
- `ViewPage`
- `ViewPageClient`
- `ViewerShell`

## Checklist mapping
- Plan 2.1 config migration: replaced fork-local `/api/config` coverage with direct `getPublicConfig()` contract usage and browser-safe build-version fallback.
- Plan 2.2 satellite migration: replaced `/api/tle` consumer path with in-process `getTleApiResponse()`, local cache persistence, proxy-backed browser fetches, and existing contract parsing/deduping.
- Plan 2.3 health migration: replaced `/api/health` polling with local `fetchHealthStatus()` derivation from TLE cache metadata.
- Plan 2.5 static/export cleanup: moved `/view` query parsing into a client child under `Suspense` so `/view` builds as static content.
- Plan 3 validation: updated unit coverage for no-route-handler contract, config/health parity, TLE proxy path + stale behavior, and client-side `/view` parsing.

## Assumptions
- Using a browser-safe proxy for CelesTrak is allowed per the recorded clarification as long as payload and behavior parity are preserved.
- Existing aircraft reassurance copy remains truthful because this phase did not change the fork’s aircraft request path.

## Preserved invariants
- `PublicConfig`, `HealthApiResponse`, and `TleApiResponse` payload shapes stay unchanged for consumers.
- TLE freshness windows remain 6 hours fresh and 24 hours stale fallback.
- Satellite validation, NORAD deduping, and ISS grouping semantics remain unchanged.
- Permissions-policy/embed behavior stays fork-local via the existing `next.config.ts` headers.

## Intended behavior changes
- `SkyLensServerless` no longer owns app route handlers for config, health, or TLE.
- TLE cache metadata persists in browser storage under a fork-local key so stale/fresh state survives page reloads.
- `/view` no longer depends on server-side `searchParams`; it parses query state from the client router path while keeping the route statically prerenderable.

## Known non-changes
- Viewer UX, schemas, and settings behavior were not intentionally changed beyond serverless plumbing.
- Aircraft data sourcing and privacy copy were not changed in this phase.

## Expected side effects
- TLE requests now travel through the configured proxy template instead of a fork-local Next route.
- Health status reflects the local browser cache rather than a server memory cache.

## Validation performed
- `npm test`
- `npm run build`
- Verified build output statically prerenders `/view`.

## Deduplication / centralization
- Centralized health derivation in `lib/health/client.ts` so the viewer and tests share one fork-local health contract source.
- Centralized TLE cache persistence and proxy URL construction inside `lib/satellites/tle.ts` so the viewer-facing client keeps the same entry point.
