# Test Strategy

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: satellite-layer
- Phase Directory Key: satellite-layer
- Phase Title: Satellite layer
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 `/api/tle` payload contract
  - `tests/unit/satellite-layer.test.ts`
  - Covers deduplicated NORAD ids, overlapping group preservation, ISS flagging, and `fetchedAt`/`expiresAt` shape.
- AC-2 deterministic client propagation
  - `tests/unit/satellite-layer.test.ts`
  - Covers ISS and a non-ISS sample satellite with fixed observer/time fixtures plus projection checks.
- AC-3 stale-cache resilience and hide-on-no-cache behavior
  - `tests/unit/satellite-layer.test.ts`
  - Covers stale serving within the allowed window, stale cutoff after expiry plus 24h, and visibility suppression for hidden satellites.
  - `tests/unit/viewer-shell.test.ts`
  - Covers that the new TLE fetch side effect is gated behind verified live viewer state.
  - `tests/unit/viewer-shell-celestial.test.ts`
  - Covers that satellite-layer failures do not trigger the astronomy critical-fallback demo transition.
- AC-4 detail-card contract and ISS badge
  - `tests/unit/satellite-layer.test.ts`
  - Covers metadata/detail payload completeness for propagated satellite objects.
  - `tests/unit/viewer-shell-celestial.test.ts`
  - Covers rendered `NORAD ID`, `Range`, and ISS badge content in the viewer cards.

## Preserved invariants checked

- Satellite ids remain stringified NORAD ids.
- `likelyVisibleOnly` suppresses satellites when Sun altitude is above `-4°`.
- Satellites below `10°` elevation do not enter the renderable object set.
- Blocked preflight `/view` states do not start the new TLE fetch side effect.

## Edge cases and failure paths

- Upstream refresh failure with fresh cache.
- Upstream refresh failure after the stale window expires.
- Live satellite normalization failure without astronomy failure.
- Empty/hidden satellite results when propagation or visibility rules exclude all objects.

## Stabilization notes

- All TLE tests use checked-in text fixtures instead of live network access.
- Viewer-shell tests mock the satellite client to avoid timing and network flake while still exercising the route-state and detail-card behavior.

## Known gaps

- Production-build timing remains an environment-level validation gap; the test suite does not assert build duration or bundler performance.
