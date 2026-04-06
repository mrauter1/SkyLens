# Deep-Star Render Quality v3 Plan

## Intent
- Implement the SkyLensServerless deep-star visual-quality retune in the canvas renderer so stars stay compact and crisp on mobile lens diameters without changing optics eligibility, magnification semantics, or catalog fetch behavior.

## Milestone
### Compact deep-star canvas retune
- Update [scope-star-canvas.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/scope-star-canvas.tsx) only for rendering behavior:
  - add local pure helpers `getLensCompressionFactor(diameterPx)` and `compressRadius(radiusPx, compressionFactor, min, max)`
  - compress incoming `corePx` and `haloPx` into compact envelopes before drawing
  - keep two-pass rendering, but switch halo pass to radial gradient with transparent edge
  - draw halo only when compressed core radius is at or above a deterministic threshold
  - keep deterministic solid-fill halo fallback if `createRadialGradient` is unavailable or fails
- Expand [scope-star-canvas.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/scope-star-canvas.test.tsx) to cover:
  - gradient creation and color-stop ordering
  - compressed/clamped radius envelopes
  - halo suppression below threshold
  - fallback halo rendering when gradient creation fails
  - unchanged B-V color mapping
- Keep [viewer-shell-scope-runtime.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx) focused on runtime invariants, updating only if needed to keep assertions aligned with the smaller rendered radii while preserving:
  - likely-visible/daylight suppression behavior for deep-star fetch/render gating
  - optics limiting-magnitude filtering
  - below-horizon rejection
  - magnification-driven spacing without linear size growth

## Interfaces And Ownership
- `ScopeStarCanvasPoint` stays unchanged: renderer still consumes `x`, `y`, `bMinusV`, `intensity`, `corePx`, `haloPx`.
- `computeScopeRenderProfile(...)` and `passesScopeLimitingMagnitude(...)` stay unchanged and remain the canonical runtime producers/filters.
- `viewerSettings.scopeOptics.magnificationX` remains canonical. No migration or settings-shape changes are planned.

## Rendering Contract
- Compression factor is diameter-aware, deterministic, and clamped to roughly `[0.72, 1.0]`.
- Effective core radius is compressed/clamped into a compact envelope near `[0.9, 2.2]`.
- Effective halo radius is compressed/clamped into a compact envelope near `[1.4, 3.6]`.
- Core pass always renders as solid fill.
- Halo pass uses center-alpha to zero-edge radial falloff and must not increase perceived size on small lenses.
- Halo opacity and core opacity remain monotonic with `intensity`.
- Fallback behavior for malformed profile inputs remains finite and deterministic.

## Regression Surfaces
- Deep-star gating order in [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx) must remain:
  - existing likely-visible/daylight suppression gate
  - below-horizon rejection
  - optics limiting-magnitude gate
  - render-profile generation
  - projection and lens inclusion
- No edits to `lib/viewer/scope-optics.ts`, catalog resolution, deployment scripts, or `.bin` assets.
- Existing color semantics from `bMinusV` must not change.
- Runtime spacing behavior must continue to respond to magnification even though rendered radii become smaller.

## Validation
- Required:
  - `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`
- Broader regression pack if the focused run is stable:
  - `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-lens-overlay.test.tsx`
- Delivery must include no binary artifacts, a non-amended commit containing the code and tests, and a summary of final tuned core/halo envelopes plus test results.

## Risk Register
- Gradient stubs in unit tests may need richer mocks than current flat-fill capture; keep test doubles local to the canvas test to avoid unrelated DOM/canvas regressions.
- Over-compression could flatten optics response; guard by preserving monotonic opacity response and by keeping runtime spacing tests unchanged.
- Fallback handling must be explicit so environments lacking gradient support still render deterministic halos instead of silently dropping the halo pass.

## Rollback
- Revert the canvas-only retune in [scope-star-canvas.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/scope-star-canvas.tsx) and restore prior flat halo drawing if the compact envelopes or gradient path create regressions.
- Keep runtime/optics files untouched so rollback remains local to the renderer/tests.
