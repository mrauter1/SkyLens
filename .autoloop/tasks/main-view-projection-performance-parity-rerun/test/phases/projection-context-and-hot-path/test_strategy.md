# Test Strategy

- Task ID: main-view-projection-performance-parity-rerun
- Pair: test
- Phase ID: projection-context-and-hot-path
- Phase Directory Key: projection-context-and-hot-path
- Phase Title: Shared Non-Scope Projection Context
- Scope: phase-local producer artifact

## Behavior-to-Test Coverage Map
- Shared non-scope stage projector wiring in `viewer-shell.tsx`
  - Covered by `tests/unit/viewer-shell-celestial.test.ts`
  - Asserts `buildVisibleConstellations()` always receives `projectLinePoint` plus explicit stage viewport dimensions before magnification is enabled.
- Constellation endpoint parity with bright markers
  - Covered by `tests/unit/viewer-shell-celestial.test.ts`
  - Checks subpixel endpoint-to-marker alignment at default main-view scale and under main-view magnification.
- Focused trail parity with bright markers
  - Covered by `tests/unit/viewer-shell-celestial.test.ts`
  - Checks focused aircraft trail start points stay aligned with aircraft markers under main-view magnification.
- Main-view deep-star parity with bright markers
  - Covered by `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Checks deep-star markers remain co-located with bright-object markers under magnified non-scope projection.
- Explicit source-dimension propagation and deterministic fallback
  - Covered by `tests/unit/projection-camera.test.ts`
  - Checks profile-aware source-frame mapping and fallback to viewport-sized source dimensions for legacy callers.
- Bundled constellation validation outside the build hot path
  - Covered by `tests/unit/celestial-layer.test.ts`
  - Checks `buildVisibleConstellations()` no longer depends on per-call `starCatalog` validation while bundled validation stays eager in module init.

## Preserved Invariants Checked
- Scope-mode projection behavior stays covered indirectly by unchanged scope-runtime tests.
- Scope deep-star main-view selection continues to use the stage viewport when scope mode is off.
- Existing constellation override projector behavior remains intact.

## Edge Cases
- Default main-view scale and magnified main-view scale both covered for constellation endpoint alignment.
- Omitted `sourceWidth`/`sourceHeight` fallback covered with explicit viewport-sized equivalence.
- Empty caller `starCatalog` no longer causes per-build validation failure.

## Failure Paths
- Regression where viewer-shell forgets to pass the shared projector to constellation rendering.
- Regression where non-scope default-scale or magnified constellation endpoints drift from bright-object markers.
- Regression where hot-path constellation builds reintroduce caller-driven validation.

## Flake Risk / Stabilization
- DOM parity tests use mocked celestial data and deterministic slider interactions only.
- Scope-runtime coverage uses mocked fetch fixtures and fixed demo scenarios; no live network or sensor timing is involved.

## Known Gaps
- This phase does not add new scope-lens clipping/projection assertions because that behavior is out of scope and already preserved by existing adjacent suites.
