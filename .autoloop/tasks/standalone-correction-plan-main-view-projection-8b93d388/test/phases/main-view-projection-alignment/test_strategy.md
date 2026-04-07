# Test Strategy

- Task ID: standalone-correction-plan-main-view-projection-8b93d388
- Pair: test
- Phase ID: main-view-projection-alignment
- Phase Directory Key: main-view-projection-alignment
- Phase Title: Main-View Projection Alignment
- Scope: phase-local producer artifact

## Behavior To Coverage Map
- AC-1 main-view profile crop mapping:
  `SkyLensServerless/tests/unit/projection-camera.test.ts`
  Covers profile-aware stage projection with `sourceWidth` / `sourceHeight` under cover-crop mapping and distinguishes that path from viewport-only projection.
- AC-2 deep-star alignment with magnified non-scope main view:
  `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  Covers main-view deep stars co-locating with a bright-object marker after desktop main-view magnification changes.
- AC-3 overlay consistency under magnification:
  `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  Covers constellation line endpoints matching marker projection and focused aircraft trail points matching aircraft marker projection when main-view magnification is active.
- Optional hook compatibility for constellation pipeline:
  `SkyLensServerless/tests/unit/celestial-layer.test.ts`
  Covers the backward-compatible `projectLinePoint` hook so the shared projector can flow through constellation segment generation without duplicating catalog traversal.

## Preserved Invariants Checked
- Scope-only geometry/clipping remains on the existing runtime path:
  existing scope-runtime tests still pass under `SkyLensServerless` vitest config.
- Main-view magnification remains projection/FOV-only:
  overlay and deep-star tests change magnification and assert projected position behavior, not marker-size scaling.
- No persistence or alignment-target rule changes are encoded in new expectations.

## Edge Cases / Failure Paths
- Crop-mapped profile projection is verified against explicit source-frame math rather than a same-helper mirror assertion.
- Deep-star runtime coverage exercises the non-scope path with a bright object at the same pointing to catch projector divergence.
- Constellation coverage verifies the optional hook path without requiring a broad refactor of catalog traversal.

## Reliability / Stabilization
- Root and `SkyLensServerless` trees are validated with their own `vitest` configs because they are separate codepaths.
- The serverless deep-star alignment assertion uses an explicit `0.05px` epsilon to absorb DOM subpixel jitter and avoid flaky decimal-precision failures.
- Tests use mocked fetch/catalog/sensor dependencies and fixed viewport bounds to keep timing and geometry deterministic.

## Known Gaps
- No E2E/demo browser assertion was added in this phase; coverage remains unit/runtime-level.
