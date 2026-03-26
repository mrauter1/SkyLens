# Test Strategy

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: aircraft-layer
- Phase Directory Key: aircraft-layer
- Phase Title: Aircraft layer
- Scope: phase-local producer artifact

## Behavior to coverage map

- AC-1 request validation and normalized route payload:
  `tests/unit/aircraft-layer.test.ts`
  Covers invalid `400` handling and valid normalized `/api/aircraft` responses.
- AC-2 rounded-bucket cache reuse without observer-math reuse:
  `tests/unit/aircraft-layer.test.ts`
  Covers cache hits for equivalent rounded buckets with changed observer altitude.
- AC-2 bucket-edge fetch correctness:
  `tests/unit/aircraft-layer.test.ts`
  Covers widened OpenSky bbox behavior so edge-of-bucket observers still receive in-radius aircraft.
- AC-3 degraded upstream handling:
  `tests/unit/aircraft-layer.test.ts`
  Covers empty-aircraft degraded responses on total upstream failure.
- AC-3 authenticated/anonymous fallback:
  `tests/unit/aircraft-layer.test.ts`
  Covers credentialed success, one-time `401` token refresh, and authenticated-failure fallback to anonymous latest-state access.
- AC-4 aircraft detail-card contract:
  `tests/unit/aircraft-layer.test.ts`
  Covers `Unknown flight`, altitude feet/meters, heading cardinal, speed, range, and origin-country metadata.
- UI subtle outage messaging seam:
  `tests/unit/settings-sheet.test.tsx`
  Covers aircraft availability copy rendering in settings.
- Viewer detail-card rendering contract:
  `tests/unit/viewer-shell-celestial.test.ts`
  Covers aircraft detail-card field rendering through the shared viewer object pipeline.

## Preserved invariants checked

- Client fetches only `/api/aircraft`, never OpenSky directly.
- Aircraft IDs remain stable `icao24-*` values.
- Aircraft outages stay non-critical and do not require demo fallback.
- Equivalent cache buckets reuse one upstream fetch for 10 seconds.

## Edge cases and failure paths

- Invalid query params.
- Edge-of-bucket observer coverage.
- Missing callsign fallback.
- Full upstream outage.
- Authenticated token issuance success.
- Authenticated state fetch `401` refresh.
- Authenticated state fetch failure with anonymous success fallback.

## Flake risks / stabilization

- All OpenSky/network behavior is mocked with deterministic `fetch` stubs.
- Cache-sensitive tests call `resetAircraftCacheForTests()` in `beforeEach`.
- No real timers, network, or browser permissions are used in the aircraft unit suite.

## Known gaps

- Production `next build` still times out in the broader phase validation and is not isolated to a deterministic unit-test repro here.
