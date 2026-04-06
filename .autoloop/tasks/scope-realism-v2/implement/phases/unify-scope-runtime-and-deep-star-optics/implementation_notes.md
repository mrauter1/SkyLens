# Implementation Notes

- Task ID: scope-realism-v2
- Pair: implement
- Phase ID: unify-scope-runtime-and-deep-star-optics
- Phase Directory Key: unify-scope-runtime-and-deep-star-optics
- Phase Title: Apply canonical scope optics across runtime projection, deep-star filtering, and rendering
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/unit/scope-optics.test.ts`
- `SkyLensServerless/tests/unit/scope-lens-overlay.test.tsx`

## Symbols touched
- `ViewerShell`
- `ScopeStarCanvas`
- `ScopeStarCanvasPoint`
- `computeScopeRenderProfile`
- `passesScopeLimitingMagnitude`

## Checklist mapping
- M2 runtime FOV unification: preserved the magnification-derived `scopeEffectiveVerticalFovDeg` as the shared source for projection, band selection, tile radius, marker sizing, and status; no new divergence introduced.
- M3 deep-star optics gating/rendering: added below-horizon rejection, post-gate limiting-magnitude filtering, deep-star `scopeRender` metadata, and profile-driven canvas payload/rendering.
- Validation coverage: extended optics/runtime tests for retention monotonicity, deep-star filtering, photometry response, magnification-driven spacing, and unchanged daylight suppression.

## Assumptions
- Existing bright-star `scopeRender` metadata semantics remain the canonical optics contract for scope star rendering.
- The current demo/runtime test fixtures can validate spacing and photometry through canvas draw capture without adding a new exported runtime helper.

## Preserved invariants
- Likely-visible/daylight suppression order and thresholds are unchanged.
- Deep-star optics gating happens only after the existing upstream gates and an explicit below-horizon check.
- Scope stars remain compact; magnification changes projection spacing rather than scaling diameters linearly.
- Persistence/storage behavior from the prior canonical optics phase is unchanged in this phase.

## Intended behavior changes
- Deep stars now fail scope rendering when they are below the horizon or below the scope limiting magnitude after the existing deep-star enablement gates.
- Passing deep stars now carry optics-driven render metadata and render on the scope canvas from `intensity`, `corePx`, and `haloPx`.

## Known non-changes
- No server-side or scope dataset format changes.
- No new daylight or likely-visible policy changes.
- No broad refactor of unrelated viewer projection, labels, or settings ownership.

## Expected side effects
- Named synthetic deep-star fixtures used by runtime tests needed brighter test magnitudes so center-lock remained valid under the new optics gate.
- Canvas-based tests now rely on captured draw calls to validate photometry and spacing behavior.

## Validation performed
- `npm test -- tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-lens-overlay.test.tsx` ✅
- `npm test` ❌ existing unrelated failures remain in `tests/unit/viewer-shell-celestial.test.ts`:
  - `allows dim stars to shrink to 1 px without changing brighter star sizes or the non-star minimum at scale 1` timed out after 10000 ms.
  - `renders a low-quality motion vector for a moving object as scene time advances` failed with `No interval registered for 1000ms`.
  - `suppresses the trail polyline when prefers-reduced-motion is enabled` failed with `No interval registered for 1000ms`.

## Deduplication / centralization decisions
- Reused the existing optics helpers in `lib/viewer/scope-optics.ts` instead of duplicating limiting-magnitude or render-profile math in the viewer runtime.
- Reused `metadata.scopeRender` for deep stars so existing scope marker/canvas consumers can read one optics metadata shape.
