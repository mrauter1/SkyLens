# Scope Realism Final v5 Plan

## Intent
Implement `SkyLensServerless/scope-realism-final-v5-prd-ard.md` without widening scope. Keep `scopeOptics.magnificationX` canonical, remove deep-star halo rendering, add display-only aperture attenuation for deep stars, make scope-mode bright-object size/brightness respond deterministically to magnification and aperture, add persisted `scopeLensDiameterPct`, and preserve existing deep-star gating order and settings compatibility.

## Milestones
1. Add the new setting and UI wiring so runtime can consume `scopeLensDiameterPct` safely from persisted settings.
2. Rework scope-mode rendering behavior in `viewer-shell` and `scope-star-canvas` for deep stars and extended objects without changing catalog fetch/gating order.
3. Expand the targeted tests to prove migration safety, visual-model determinism, and no `.bin` regressions.

## Interfaces And Change Surfaces

### Settings model
- File: `SkyLensServerless/lib/viewer/settings.ts`
- Add `scopeLensDiameterPct: number` to `ViewerSettings`.
- Default to `75`.
- Read older payloads without failure; missing/invalid values normalize to `75`.
- Clamp persisted/runtime values to the supported UI range `50..90`.
- Persist normalized values through `writeViewerSettings`.
- Keep existing `scope.verticalFovDeg` and `scopeOptics` migration semantics unchanged.

### Settings UI contract
- File: `SkyLensServerless/components/settings/settings-sheet.tsx`
- Add props for `scopeLensDiameterPct?: number` and `onScopeLensDiameterPctChange?: (value: number) => void`.
- Add a range control labeled `Telescope diameter` using percent-of-screen-height copy and surfacing `75%` by default.
- Keep `SettingsSheet` presentation-only; it emits value changes and does not own normalization logic.

### Viewer runtime contract
- File: `SkyLensServerless/components/viewer/viewer-shell.tsx`
- Pass the new setting into `SettingsSheet` and update local `viewerSettings` state on change.
- Replace hard-coded scope lens diameter computation with a function derived from `viewport.height * (scopeLensDiameterPct / 100)` and bounded by explicit safety clamps.
- Safety clamp must still keep the circular scope overlay fully usable within the current viewport; implementation should not allow portrait layouts to overflow horizontally.
- Preserve square lens selection math and continue using the final clamped lens diameter for projection, tile selection radius, overlay frame size, and center-lock behavior.

### Deep-star rendering contract
- Files: `SkyLensServerless/components/viewer/scope-star-canvas.tsx`, `SkyLensServerless/components/viewer/viewer-shell.tsx`
- Keep `ScopeStarCanvasPoint.haloPx` in the payload for compatibility, but renderer must ignore it.
- Render each deep star with exactly one fill pass using `corePx`, `intensity`, and `bMinusV`.
- Clamp compact core radius and alpha to deterministic bounds.
- Apply extra aperture attenuation only after `computeScopeRenderProfile` returns, when mapping deep-star canvas points in `viewer-shell`.
- Preserve existing deep-star inclusion order: daylight/likely-visible behavior, horizon rejection, limiting-magnitude gate, then render-profile compute.

### Extended-object scope realism contract
- File: `SkyLensServerless/components/viewer/viewer-shell.tsx`
- Keep ownership local to `viewer-shell.tsx` with one body-id-keyed baseline angular-size table for scope extended objects; do not widen the celestial pipeline contract for this task.
- Use stable angular baselines in that local table:
  - `sun` and `moon`: known average apparent diameters in degrees.
  - `planet-*`: stable per-planet baseline apparent diameters for scope rendering fallback because current celestial metadata does not expose dynamic angular diameter.
- Replace current scope-mode fixed marker sizing for `sun`, `moon`, and `planet` objects with deterministic projected-diameter math:
  - `projectedDiameterPx = lensDiameterPx * (baselineAngularDiameterDeg / scopeEffectiveVerticalFovDeg)`
  - clamp with practical family-specific bounds so Sun/Moon remain usable and planets remain visible without dominating the lens.
- Add a deterministic brightness model for those objects that increases with aperture support and does not brighten unnaturally when magnification increases at fixed aperture.
- Keep the brightness helper local to `viewer-shell.tsx`, with monotonic rules:
  - fixed magnification, larger aperture => same or higher opacity
  - fixed aperture, larger magnification => same or lower opacity
- Preserve existing object ids and `SkyObject` metadata shape; `viewer-shell` derives size/brightness from object id, type, aperture, magnification, and the final clamped lens diameter.
- Do not route extended objects through the deep-star canvas path.
- Keep non-scope wide-view marker behavior unchanged.

## Ordered Implementation Plan

### Phase 1: Settings, migration, and UI wiring
- Extend the settings schema/defaults/normalization path with `scopeLensDiameterPct`.
- Thread the new value and setter through `viewer-shell` into `SettingsSheet`.
- Add the new range control next to existing scope controls, following current control patterns.
- Regression focus: older localStorage payloads, invalid stored values, immediate UI-to-runtime updates.

### Phase 2: Scope runtime visual realism
- Convert `ScopeStarCanvas` to core-only deep-star drawing and remove halo/gradient behavior.
- In `viewer-shell`, attenuate deep-star display intensity by aperture after the existing scope render profile is computed.
- Replace `getScopeLensDiameterPx` and any dependent assumptions with height-derived, safely clamped lens sizing.
- Rework scope bright-object size and opacity helpers so Sun/Moon/planets use the viewer-shell-owned baseline angular-size table, scale with magnification/FOV, and respond to aperture + magnification deterministically.
- Regression focus: deep-star gating order, scope tile selection radius, center-lock selection, existing star color mapping, existing scope marker ordering/highlighting, and malformed `scopeRender` fallback behavior for bright markers where still applicable.

### Phase 3: Test coverage and verification
- Update `scope-star-canvas.test.tsx` to assert one draw pass per star, no halo/gradient path, compact radius/alpha clamps, and unchanged B-V color mapping.
- Update `viewer-settings.test.tsx` to cover defaulting, clamp, persistence, and backward-compatible reads for `scopeLensDiameterPct`.
- Update `settings-sheet.test.tsx` to cover rendering and callback delegation for the new telescope diameter control.
- Update `viewer-shell-scope-runtime.test.tsx` to cover aperture-driven deep-star dimness, unchanged deep-star gating behavior, magnification-driven bright-object sizing / non-brightening rules, and runtime lens diameter changes affecting actual lens px behavior.
- Treat `viewer-shell.test.ts`, `viewer-shell-celestial.test.ts`, `scope-lens-overlay.test.tsx`, and `scope-lens-overlay`-related assertions as the explicit broader regression watchlist because they already cover lens frame size, scope marker rendering, and overlay ordering.
- Run the minimum required test command, then run the broader scope watchlist when Phase 2 changes land or if any related assertion moves, and confirm `git status` shows no `.bin` additions.

## Compatibility Notes
- Settings storage key remains unchanged; backward compatibility is handled by defaulting missing `scopeLensDiameterPct`.
- `scopeOptics.magnificationX` remains the canonical source for scope FOV semantics; `scope.verticalFovDeg` stays a derived compatibility field.
- Deep-star payload compatibility is preserved by leaving `haloPx` in the canvas point type even though rendering ignores it.
- Scope lens sizing becomes configurable, but the overlay must remain bounded to current viewport constraints to avoid breaking mobile layouts.
- Extended-object realism stays local to `viewer-shell.tsx`; no `SkyObject`/celestial metadata migration is introduced for this task.

## Regression Prevention
- Do not alter catalog source order, tile formats, fetch URLs, or any `.bin` handling.
- Do not move aperture attenuation into catalog filtering or limiting-magnitude logic; it is display-only.
- Do not change the ordering of deep-star visibility gates before render-profile computation.
- Do not reintroduce per-object ad hoc fixed scope marker constants outside the single viewer-shell baseline angular-size table.
- Keep wide-view marker sizing/opacity logic unchanged unless a test or compile dependency requires a local adjustment.
- Prefer local helper updates inside existing viewer/runtime files over introducing new abstraction layers.

## Validation And Rollback
- Validate with the required targeted tests first, then run adjacent scope tests if any marker-sizing or overlay regressions appear.
- Manually verify from test expectations that lens frame size changes when the setting changes and that bright-object markers still render inside the circular overlay.
- Rollback path if a regression appears:
  - Revert the new extended-object scope sizing/opacity helpers independently from settings migration.
  - Revert height-derived lens sizing independently from the persisted setting if overlay fit becomes unstable.
  - Revert core-only deep-star renderer independently only if deterministic tests show a rendering contract break.

## Risk Register
- Risk: Height-derived lens sizing can overflow narrow portrait layouts if implemented literally from viewport height.
  - Control: clamp against explicit UX min/max and viewport fit constraints while keeping height percentage as the source input.
- Risk: Extended-object realism changes can unintentionally alter center-lock prominence or marker usability.
  - Control: keep a single viewer-shell-owned baseline angular-size table, practical family-specific size/opacity clamps, and cover scope marker behavior in runtime and celestial/overlay regression tests.
- Risk: Spreading angular-size ownership across `viewer-shell` and `celestial.ts` would create repeated future edits and unclear source-of-truth.
  - Control: keep the deterministic size-input contract local to `viewer-shell.tsx` for this task and avoid changing `SkyObject` metadata.
- Risk: Removing halo rendering can make marginal stars disappear if alpha/radius clamps are too aggressive.
  - Control: keep compact lower bounds and add aperture-dimness tests that compare weak vs strong optics rather than brittle snapshot values.
- Risk: Settings migration can silently drift if normalization is split across UI and storage paths.
  - Control: keep clamping/defaulting centralized in `normalizeViewerSettings` / read-write helpers.
