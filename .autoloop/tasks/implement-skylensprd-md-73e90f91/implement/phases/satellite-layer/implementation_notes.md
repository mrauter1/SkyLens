# Implementation Notes

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: satellite-layer
- Phase Directory Key: satellite-layer
- Phase Title: Satellite layer
- Scope: phase-local producer artifact

## Files changed

- `package.json`
- `package-lock.json`
- `app/api/tle/route.ts`
- `components/viewer/viewer-shell.tsx`
- `lib/cache/index.ts`
- `lib/satellites/contracts.ts`
- `lib/satellites/tle.ts`
- `lib/satellites/client.ts`
- `tests/fixtures/tle/stations.txt`
- `tests/fixtures/tle/brightest.txt`
- `tests/unit/satellite-layer.test.ts`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`

## Symbols touched

- `createMemoryCache`, `CacheEntry`, `CacheStore`
- `getTleApiResponse`, `resetTleCacheForTests`
- `fetchSatelliteCatalog`, `normalizeSatelliteObjects`
- `ViewerShell`, `buildSkyScene`, `getDetailRows`

## Checklist mapping

- M4 `/api/tle` contract: implemented in `app/api/tle/route.ts` + `lib/satellites/tle.ts`
- M4 shared cache seam: implemented in `lib/cache/index.ts`
- M4 client propagation/normalization: implemented in `lib/satellites/client.ts`
- M4 satellite detail-card contract + ISS badge: implemented in `components/viewer/viewer-shell.tsx`
- M4 fixtures/tests: added `tests/fixtures/tle/*.txt` and `tests/unit/satellite-layer.test.ts`

## Assumptions

- The PRD `brightest` group should stay public-facing while the upstream source uses CelesTrak's `visual` feed.
- The stale serving window is 24 hours after the 6-hour refresh TTL expires.

## Preserved invariants

- `/api/tle` ids remain stable stringified NORAD ids.
- Overlapping group membership is preserved during NORAD deduplication.
- ISS state is carried through both the API payload and `SkyObject.metadata.isIss`.
- Satellite outages hide only the satellite layer and do not trigger the celestial critical-failure demo fallback.

## Intended behavior changes

- Live viewer sessions now fetch `/api/tle`, cache the latest catalog client-side, and project satellites alongside celestial objects.
- Satellite detail cards now show `Type`, `NORAD ID`, `Elevation`, `Azimuth`, optional `Range`, and an `ISS` badge when applicable.
- `/api/tle` now serves fresh data for 6 hours and stale cached data for up to 24 more hours when refreshes fail.

## Known non-changes

- Demo mode still does not ship bundled satellite scenarios; live TLE fetch remains skipped there until the demo-mode milestone.
- Aircraft integration and health-route reporting remain out of scope for this phase.

## Expected side effects

- Added `satellite.js` as a runtime dependency for client propagation.
- Viewer-shell tests now mock the satellite client alongside the existing astronomy mocks.

## Validation performed

- `npm run lint`
- `npm run test`
- `npm run test -- tests/unit/satellite-layer.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/config-contract.test.ts`
- `npm run build` started repeatedly but did not complete in this environment; it remained stuck in Next.js/PostCSS build work without surfacing a compile error before manual termination.

## Deduplication / centralization

- Centralized TLE schemas in `lib/satellites/contracts.ts` so the route and client validate the same payload contract.
- Centralized TLE fetch/merge/cache behavior in `lib/satellites/tle.ts` instead of splitting cache and normalization logic across the route and tests.
