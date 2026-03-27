# Test Strategy

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: test
- Phase ID: projection-foundations
- Phase Directory Key: projection-foundations
- Phase Title: Projection And Basis Foundations
- Scope: phase-local producer artifact

## Behavior-to-test coverage

- AC-1 `cover-crop projection placement`
  Covered by `projects screen points using source-frame dimensions under cover cropping` in `tests/unit/projection-camera.test.ts`.
  Checks the same projected image-plane sample against the explicit cover-scale/crop formula.
- AC-2 `source-frame helpers and preserved semantics`
  Covered by `maps image-plane points through object-fit cover cropping`, `defaults source dimensions to the viewport for legacy callers`, and `preserves overscan visibility when cover cropping pushes a point just outside the viewport`.
  Confirms crop math, source-dimension defaulting for backward compatibility, `visible`/`inViewport`/`inOverscan` semantics, and keeps the existing center-lock ranking test unchanged.
- AC-3 `basis helpers without manual-mode regression`
  Covered by `rebuilds the same manual quaternion from exported basis helpers` plus the existing manual projection stability tests through zenith and nadir.

## Preserved invariants checked

- `createCameraQuaternion()` remains normalized and still centers forward-facing objects.
- Omitting `sourceWidth`/`sourceHeight` remains equivalent to explicitly passing the viewport size.
- East/west ordering and behind-camera culling still behave as before.
- Center-lock candidate ranking remains angular-distance driven within the existing radius.

## Edge cases

- Widened FOV clamp now accepts the intended `20..100` vertical-degree range.
- Cover-crop mapping is exercised both for fully off-screen and overscan-visible image-plane points.
- Backward-compatible viewport-only callers are exercised through the default source-dimension path.

## Failure paths

- Rear-camera acquisition still retries from exact `facingMode: { exact: 'environment' }` to `'environment'`.
- Behind-camera points remain non-visible.

## Flake risk / stabilization

- All new projection assertions use fixed viewport/source dimensions and explicit numeric expectations; no timers, network, sensors, or browser APIs are involved.

## Known gaps

- This phase does not yet cover viewer-shell wiring of real per-frame video metadata; that belongs to later runtime integration phases.
