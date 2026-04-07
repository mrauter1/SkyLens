# Main-View Projection Alignment + Overlay Consistency

## Scope
- Fix C1/C2/C3 for magnified non-scope main view in the existing projection flow.
- Preserve scope-only projection/clipping, aperture-driven emergence, deterministic center-lock ordering, and main-view magnification as projection/FOV-only behavior.

## Current Findings
- `SkyLensServerless/components/viewer/viewer-shell.tsx` drops `sourceWidth` / `sourceHeight` in the `useStageProfileProjection` branch for `projectedObjects`.
- The same file drops source-frame dimensions for non-scope deep stars when `projectWorldPointToScreenWithProfile` is used with `activeProjectionProfile`.
- Focused aircraft trails are still projected through `projectWorldPointToScreen(...)` with the base vertical-FOV path even when the main view is using profile magnification.
- Constellation line segments are preprojected inside `SkyLensServerless/lib/astronomy/constellations.ts` via the base wide-view path, so viewer-shell cannot keep them aligned under main-view magnification without a shared projector hook or equivalent reprojection-capable data.

## Milestones
1. Define one shared non-scope stage projection path in `viewer-shell.tsx`.
   - Add a small local helper for the stage viewport payload: `width`, `height`, plus `cameraFrameLayout?.sourceWidth` / `sourceHeight`.
   - Add a small local projector helper for non-scope stage points that reuses `useStageProfileProjection`, `stageProjectionProfile`, and the existing wide wrapper without creating parallel projection state.
2. Apply the shared projector everywhere the magnified main view must stay co-located.
   - Use it for `projectedObjects` in the profile branch.
   - Use it for non-scope deep-star projection so deep stars, bright objects, and center-lock candidates share the same mapping.
   - Use it for focused aircraft trail sample projection in non-scope mode when main-view magnification is active.
   - Route constellation line-segment projection through the same projector while preserving the current scope behavior and default wide-view behavior elsewhere.
3. Validate correctness and regression safety.
   - Add targeted coverage for source-frame crop mapping under profile projection.
   - Add viewer/runtime assertions that markers, deep stars, constellation segments, and focused aircraft trails stay aligned under magnified main view.
   - Re-run scope/runtime coverage to confirm no scope-mode regressions.

## Interface Definitions
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
  - Introduce only local helpers; do not add new persistent state or parallel profile-selection flags.
  - Reuse `cameraFrameLayout`, `useStageProfileProjection`, `stageProjectionProfile`, and `activeProjectionProfile` directly.
- `SkyLensServerless/lib/astronomy/constellations.ts`
  - If needed, extend `buildVisibleConstellations(...)` with one optional internal projection hook for line-segment projection.
  - Keep the current default behavior for callers that do not supply the hook so `celestial-layer` coverage and any other consumers remain compatible.

## Test Plan
- `SkyLensServerless/tests/unit/projection-camera.test.ts`
  - Extend profile-aware camera tests to cover source-frame crop mapping with `projectWorldPointToScreenWithProfile(...)`, mirroring the existing wide-wrapper crop assertions.
- `SkyLensServerless/tests/unit/viewer-shell.test.ts` and/or `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - Add live-style cropped-camera assertions for magnified main-view markers and overlays by using stage bounds that differ from source-frame dimensions.
  - Assert constellation line endpoints and focused aircraft trail points remain co-located with the corresponding projected markers when main magnification is not `1x`.
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Extend an existing deep-star runtime path to verify non-scope deep stars align with bright-object projection while scope-mode rendering remains unchanged.
- `SkyLensServerless/tests/e2e/demo.spec.ts`
  - If the existing demo harness can cheaply assert overlay/marker consistency after changing main magnification, add one magnified-main-view smoke assertion.
  - If browser dependencies or deterministic geometry make this impractical, keep E2E coverage unchanged and document the limitation in the implementation/test phase.

## Regression Risks
- Scope mode uses different viewport geometry and clipping rules; its projector path must remain untouched.
- Center-lock ordering depends on projected angular-distance ordering; fixing alignment must not introduce a second sorting path.
- Deep-star emergence and optics-derived brightness must remain independent from main-view magnification.
- Constellation changes must avoid duplicating catalog traversal or introducing a second source of line-segment truth.

## Compatibility / Rollback
- No public API, persisted settings, or CLI contract changes are planned.
- Any `buildVisibleConstellations(...)` change must stay backward-compatible and optional.
- Rollback is limited to removing the shared main-stage projector wiring and any optional constellation projection hook if regressions appear in scope overlays or celestial-layer tests.
