# Test Strategy

- Task ID: memoize-main-view-deep-star-canvas-points-20260409
- Pair: test
- Phase ID: stabilize-main-view-deep-star-canvas-points
- Phase Directory Key: stabilize-main-view-deep-star-canvas-points
- Phase Title: Stabilize main-view deep-star canvas points
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-1 effective memo boundary confirmed indirectly by [viewer-shell-scope-runtime.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx): existing `projectedDeepStars -> mainViewRenderedDeepStars -> mainViewDeepStarCanvasPoints` chain stays in place and the final `MainStarCanvas` input does not redraw on an unrelated same-mounted rerender.
- AC-2 preserved behavior covered in [viewer-shell-scope-runtime.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx): main-view deep stars remain canvas-rendered, keep center-lock participation, and still surface in label flows in adjacent tests.
- AC-3 direct proof covered in [viewer-shell-scope-runtime.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx): opening the desktop viewer panel on the same mounted tree leaves cumulative deep-star canvas redraw count unchanged.
- AC-4 validation covered by focused Vitest execution, `npx tsc --noEmit`, and `npm run build` in `SkyLensServerless`.

## Preserved invariants checked
- Scope-mode gating still disables the main-view deep-star canvas path.
- Main-view deep stars remain canvas-only while retaining center-lock and label membership.
- No remount-based helper is used as evidence for redraw prevention.

## Edge cases and failure paths
- The same-mounted redraw test freezes `Date.now()` so the animated scene clock cannot create legitimate projection updates during the unrelated panel-open rerender.
- Canvas redraw detection uses cumulative `clearRect` count instead of current fill state so repainting the same stars would still fail the test.
- Repo-wide typecheck coverage includes tests, so adjacent test typing regressions were fixed and revalidated rather than excluded.

## Known gaps
- The redraw-prevention proof covers the desktop viewer panel rerender path specifically; other unrelated rerender triggers are not exhaustively enumerated here.
- Generated build/export artifacts were not normalized by this phase; they are validation side effects, not asserted behavior.
