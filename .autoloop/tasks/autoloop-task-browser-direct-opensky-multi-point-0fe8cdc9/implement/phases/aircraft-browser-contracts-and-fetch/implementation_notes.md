# Implementation Notes

- Task ID: autoloop-task-browser-direct-opensky-multi-point-0fe8cdc9
- Pair: implement
- Phase ID: aircraft-browser-contracts-and-fetch
- Phase Directory Key: aircraft-browser-contracts-and-fetch
- Phase Title: Contracts and Browser Fetch
- Scope: phase-local producer artifact

## Files changed
- `lib/aircraft/contracts.ts`
- `lib/aircraft/opensky-browser.ts`
- `lib/aircraft/client.ts`
- `lib/aircraft/opensky.ts`
- `lib/config.ts`
- `lib/demo/scenarios.ts`
- `lib/viewer/motion.ts`
- `components/viewer/viewer-shell.tsx`
- `tests/unit/aircraft-client.test.ts`
- `tests/unit/viewer-motion.test.ts`
- `tests/unit/config-contract.test.ts`

## Symbols touched
- `AircraftQuerySchema`, `AircraftApiAircraftSchema`, `AircraftApiResponseSchema`
- `DEFAULT_AIRCRAFT_RADIUS_KM`, `DEFAULT_AIRCRAFT_LIMIT`
- `fetchOpenSkyAircraft()`, `AircraftFetchError`
- `fetchAircraftSnapshot()`
- `getAircraftApiResponse()` compatibility shim
- aircraft detail metadata `trackCardinal`

## Checklist mapping
- Plan milestone 1.1: completed by rewriting aircraft contracts to include `snapshotTimeS`, `trackDeg`, OpenSky metadata, and 180 km default query radius.
- Plan milestone 1.2: completed by adding `lib/aircraft/opensky-browser.ts` with anonymous `/states/all` fetches, antimeridian split/merge, observer-relative filtering, sorting, limiting, and typed failures.
- Plan milestone 1.3: completed by rewriting `fetchAircraftSnapshot()` to delegate directly to the browser fetcher with no `/api/aircraft` dependency.
- Deferred intentionally: tracker implementation, viewer polling ownership, trail rendering, route deletion, health response cleanup, privacy copy rewrite.

## Assumptions
- For split antimeridian fetches, `snapshotTimeS` should represent the freshest upstream bucket, so the implementation uses the maximum top-level OpenSky `time`.
- Duplicate aircraft rows across split responses should keep the newest `timePositionS`, then newest `lastContactS`, instead of whichever response arrives last.
- The injected active session file path is absent in the workspace; only the parent `sessions/phases` directory exists.

## Preserved invariants
- Aircraft filtering remains observer-relative and still enforces minimum elevation, radius cap, range-first sort, and id tie-breaks.
- Non-aircraft viewer and satellite behavior was not intentionally changed.
- No app-level aircraft cache was introduced.

## Intended behavior changes
- Browser aircraft fetches now target OpenSky `/api/states/all` directly and anonymously.
- Client fetch failures now throw typed exceptions instead of returning degraded empty snapshots.
- Aircraft contract field `headingDeg` is replaced by `trackDeg`, and display metadata uses `trackCardinal` / `Track`.
- Public default aircraft radius is now 180 km.

## Known non-changes
- `/api/aircraft` route still exists in this phase, but the client no longer depends on it at runtime.
- Health response cleanup and privacy copy updates were left for later scoped phases.
- Legacy two-snapshot interpolation still exists pending the tracker phase; only the field rename fallout was updated here.

## Expected side effects
- Existing tests or fixtures that still expect `headingDeg`, `/api/aircraft`, or `aircraftCache` outside the touched set will need follow-up updates in later phases.
- `lib/aircraft/opensky.ts` preserves current `aircraftCache` health metadata compatibility by tracking only latest successful fetch timestamps and expiry, without caching aircraft payloads.

## Validation performed
- `npm ci`
- `npx vitest run tests/unit/aircraft-client.test.ts tests/unit/viewer-motion.test.ts tests/unit/config-contract.test.ts`
- `npx vitest run tests/unit/health-route.test.ts tests/unit/aircraft-client.test.ts tests/unit/viewer-motion.test.ts tests/unit/config-contract.test.ts`
- `npx eslint lib/aircraft/contracts.ts lib/aircraft/opensky-browser.ts lib/aircraft/client.ts lib/aircraft/opensky.ts lib/viewer/motion.ts lib/demo/scenarios.ts lib/config.ts components/viewer/viewer-shell.tsx tests/unit/aircraft-client.test.ts tests/unit/viewer-motion.test.ts tests/unit/config-contract.test.ts`

## Validation notes
- Targeted ESLint completed with pre-existing warnings in `components/viewer/viewer-shell.tsx` only (`react-hooks/exhaustive-deps`, one unused variable); no new errors were introduced in the touched files.

## Deduplication / centralization
- OpenSky bbox, antimeridian split, normalization, and observer-relative filtering are centralized in `lib/aircraft/opensky-browser.ts`.
- The old server aircraft module was reduced to a thin compatibility shim instead of duplicating fetch logic.
