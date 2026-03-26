# Implementation Notes

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: aircraft-layer
- Phase Directory Key: aircraft-layer
- Phase Title: Aircraft layer
- Scope: phase-local producer artifact

## Files changed

- `app/api/aircraft/route.ts`
- `lib/aircraft/contracts.ts`
- `lib/aircraft/opensky.ts`
- `lib/aircraft/client.ts`
- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `tests/unit/aircraft-layer.test.ts`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/fixtures/opensky/sample_dense.json`
- `.autoloop/tasks/implement-skylensprd-md-73e90f91/decisions.txt`

## Symbols touched

- `GET` in `app/api/aircraft/route.ts`
- `AircraftQuerySchema`, `AircraftApiResponseSchema`, `AircraftAvailabilitySchema`
- `getAircraftApiResponse`, `resetAircraftCacheForTests`, `getAircraftCacheKey`
- `fetchAircraftSnapshot`, `normalizeAircraftObjects`, `getAircraftAvailabilityMessage`
- `ViewerShell`, `buildSkyScene`, `formatSkyObjectSublabel`, `getDetailRows`
- `SettingsSheet`

## Checklist mapping

- M5 `/api/aircraft` validation, OpenSky auth/anonymous fallback, 10-second bucket cache: done
- M5 backend observer-relative azimuth/elevation/range computation: done
- M5 client normalization and aircraft detail-card contract: done
- M5 degraded aircraft availability signaling and subtle UI messaging: done
- M5 outage/cache/detail-card regression tests: done
- Deferred by phase contract: ranking/settings/trails polish beyond the subtle aircraft status seam

## Assumptions

- OpenSky bucket caching is keyed by rounded lat/lon bucket center plus requested radius; `limit` is applied after normalization so equivalent buckets can share raw state fetches safely.
- The OpenSky fetch bbox must be wider than the exact query radius by the half-bucket footprint so bucket-edge observers still receive every in-radius aircraft before exact post-filtering.
- Aircraft altitude eligibility uses `geo_altitude` when present and falls back to `baro_altitude`; records missing both are excluded per PRD.
- Aircraft speed is rendered in `km/h` because the PRD requires a speed field but does not lock a display unit.

## Preserved invariants

- Invalid query params return `400`.
- Valid aircraft requests do not leak upstream/auth errors and degrade to empty results with explicit availability semantics.
- Client never calls OpenSky directly.
- Aircraft IDs remain stable `icao24-*` values.
- Aircraft below `2°` elevation are hidden.

## Intended behavior changes

- Live viewer now polls `/api/aircraft` every 10 seconds when live location is active and the aircraft layer is enabled.
- Aircraft can render in the shared viewer pipeline with detail cards, `Unknown flight` fallback labeling, and subtle degraded messaging in settings.

## Known non-changes

- No demo aircraft dataset was introduced in this phase.
- Satellite availability messaging was not expanded yet beyond the aircraft-ready settings seam.
- Ranking budgets, trails, and settings persistence remain untouched.

## Expected side effects

- Equivalent rounded aircraft requests reuse one in-memory OpenSky fetch for 10 seconds.
- Equivalent rounded aircraft requests now preserve full in-radius coverage for any observer within the bucket instead of trimming the fetch window to the bucket center.
- Live aircraft outages no longer surface transport errors to the viewer; the layer simply empties and the UI can show the subtle availability label.

## Validation performed

- `npm run lint`
- `npm test`
- `npm test -- --run tests/unit/aircraft-layer.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx`
- `npm test -- --run tests/unit/aircraft-layer.test.ts`
- `timeout 120s npm run build` (timed out while `next build` remained in the optimized build phase with no further output)

## Deduplication / centralization

- Centralized aircraft API validation/contracts in `lib/aircraft/contracts.ts`.
- Centralized OpenSky token/cache/fallback logic in `lib/aircraft/opensky.ts`.
- Reused the shared settings-sheet availability label seam instead of adding a second aircraft-specific banner path.
