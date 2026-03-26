# Test Strategy

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: sensors-and-projection-foundation
- Phase Directory Key: sensors-and-projection-foundation
- Phase Title: Sensors and projection foundation
- Scope: phase-local producer artifact

## Behavior to test map

- Orientation normalization and smoothing: [tests/unit/orientation-foundation.test.ts](/workspace/SkyLens/tests/unit/orientation-foundation.test.ts)
- Alignment-health thresholds from steady/noisy fixtures: [tests/unit/orientation-foundation.test.ts](/workspace/SkyLens/tests/unit/orientation-foundation.test.ts)
- Recenter preserving offsets and manual-pan pose normalization: [tests/unit/orientation-foundation.test.ts](/workspace/SkyLens/tests/unit/orientation-foundation.test.ts)
- Startup observer normalization, locked high-accuracy startup options, 25m or 15s gating, and watch-position acceptance/options: [tests/unit/location-foundation.test.ts](/workspace/SkyLens/tests/unit/location-foundation.test.ts)
- Fixed FOV math, rear-camera constraints, exact-environment then environment fallback order, quaternion normalization, projection, and 4° center-lock: [tests/unit/projection-camera.test.ts](/workspace/SkyLens/tests/unit/projection-camera.test.ts)
- Shared `/view` permission-state parsing, fallback selection, and verified-live gating for live, non-camera, manual-pan, partial, and demo states: [tests/unit/permission-coordinator.test.ts](/workspace/SkyLens/tests/unit/permission-coordinator.test.ts)
- Viewer-shell startup side-effect suppression/arming for blocked, non-camera, and manual-pan states: [tests/unit/viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts)
- Route-driven viewer regressions for blocked preflight, non-camera fallback, and manual-pan fallback: [tests/e2e/permissions.spec.ts](/workspace/SkyLens/tests/e2e/permissions.spec.ts)

## Preserved invariants checked

- Unknown permission payloads stay blocked until the Start flow provides a full verified live state.
- Non-camera and manual-pan fallback remain valid live viewer states for downstream sensor/camera gating.
- Rear-camera permission probes keep `audio: false` and the exact-environment then environment fallback order.
- Startup location acquisition keeps the one-shot high-accuracy option contract, and watch-position tracking keeps the lower-power follow-up options.
- Projection keeps fixed-FOV math, front-of-camera visibility, and angular center-lock ranking.
- Location updates remain gated by movement or elapsed time instead of every watch callback.

## Edge cases and failure paths

- Wrapped headings across north do not jump during smoothing.
- Missing altitude normalizes to `0`.
- Bare `/view` and partial live-state URLs stay in preflight.
- Camera denied with motion granted still enters non-camera mode.
- Orientation denied with camera granted still enters manual-pan mode.
- Exact-environment rear-camera failures retry once with plain `environment` constraints before surfacing failure.

## Flake controls

- Unit tests use static fixtures and direct pure-function assertions.
- Browser tests drive explicit query-state URLs instead of real permission prompts or live sensors.
- Phase browser validation assumes Playwright browser binaries and Linux runtime libraries are installed in the environment.

## Known gaps

- No live sensor-browser integration tests yet; the suite remains route-driven and fixture-driven for determinism.
