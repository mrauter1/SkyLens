# Test Strategy

- Task ID: autoloop-task-browser-direct-opensky-multi-point-0fe8cdc9
- Pair: test
- Phase ID: aircraft-browser-contracts-and-fetch
- Phase Directory Key: aircraft-browser-contracts-and-fetch
- Phase Title: Contracts and Browser Fetch
- Scope: phase-local producer artifact

## Behavior to coverage map
- AC-1 contract shape:
  - `tests/unit/aircraft-client.test.ts`
  - verifies `snapshotTimeS`, `trackDeg`, observer metadata, optional OpenSky fields, and exact state-vector index mapping on successful anonymous fetches
- AC-2 direct anonymous browser fetch:
  - `tests/unit/aircraft-client.test.ts`
  - verifies OpenSky `/api/states/all` origin/path, no `time` query param, antimeridian split + merge/dedupe, typed network failure, typed 429 failure, filtering/sort/limit, and row drops for missing id/lat/lon/both altitudes
- AC-3 no aircraft client runtime dependency on `/api/aircraft`:
  - `tests/unit/aircraft-client.test.ts`
  - validates `fetchAircraftSnapshot()` goes straight to OpenSky response parsing rather than expecting proxied app payloads

## Preserved invariants checked
- `tests/unit/health-route.test.ts`
- current `/api/health` compatibility still reports aircraft fetch freshness metadata while the field exists in this phase
- `tests/unit/viewer-motion.test.ts`
- aircraft contract fallout (`trackDeg` / `snapshotTimeS`) does not break the existing aircraft motion helper expectations touched in this phase
- `tests/unit/config-contract.test.ts`
- public default aircraft radius changed to 180 km

## Edge cases
- antimeridian wrap near `+180`
- duplicate aircraft ids across split fetches
- empty/invalid aircraft rows dropped before contract validation
- range-based limit trimming after filtering

## Failure paths
- browser network failure throws typed `AircraftFetchError` with `code: 'network'`
- upstream 429 throws typed `AircraftFetchError` with `code: 'rate_limited'`

## Flake risk and stabilization
- network is fully stubbed with deterministic `fetch` mocks
- time-sensitive health assertions use fake timers with fixed timestamps
- ordering assertions rely only on deterministic sort keys already defined by the implementation (`rangeKm`, then `id`)

## Known gaps
- legacy tests that still encode `/api/aircraft`, `headingDeg`, and old health semantics are intentionally left for later phases that remove those surfaces together
- tracker, viewer-owned polling cadence, and trail behavior are out of scope for this phase
