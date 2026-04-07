# Deep Star Magnitude-Weighted Radius + Progressive Aperture Emergence

## Scope
- Adjust only the deep-star rendering path in `SkyLensServerless/lib/viewer/scope-optics.ts`, `SkyLensServerless/components/viewer/viewer-shell.tsx`, `SkyLensServerless/components/viewer/scope-star-canvas.tsx`, and directly impacted unit tests.
- Preserve the existing physical visibility gate and deep-star selection pipeline driven by `passesScopeLimitingMagnitude` and `computeScopeLimitingMagnitude`.
- Keep scope controls, daylight suppression, low-altitude suppression, and core-only rendering behavior unchanged.

## Repository Starting Point
- `scope-optics.ts` already contains `computeScopeDeepStarEmergenceAlpha` and `computeScopeDeepStarCoreRadiusPx` with the request-default constants (`EMERGE_START=-0.35`, `EMERGE_END=+0.75`, `smoothstep(t)^1.35`, `R_MIN=1.0`, `R_MAX=2.5`, `MAG_BRIGHT=1.5`, `MAG_FAINT=10.5`, `RADIUS_CURVE=0.85`).
- `viewer-shell.tsx` already maps deep stars to explicit canvas `alpha` and `radius`, using `scopeRender.effectiveLimitMag - object.magnitude` for emergence and the magnitude helper for radius.
- `scope-star-canvas.tsx` already renders one core arc per deep star from supplied `alpha` and `radius`, with broad finite-safe bounds and no halo path.
- `computeScopeRenderProfile` and `getScopeRenderProfile` are still shared with non-deep-star scope marker/detail behavior, so the full `ScopeRenderProfile` shape must remain intact even though deep-star canvas rendering only needs `effectiveLimitMag`.

## Default Tuning Contract
- Treat the existing helper constants/formulas as the implementation baseline unless a later turn explicitly retunes them:
  - Emergence alpha band: `EMERGE_START = -0.35`, `EMERGE_END = +0.75`.
  - Emergence normalization: `t = clamp((deltaMag - EMERGE_START) / (EMERGE_END - EMERGE_START), 0, 1)`.
  - Emergence curve: `alpha = smoothstep(t) ^ 1.35`.
  - Radius mapping defaults: `R_MIN = 1.0`, `R_MAX = 2.5`, `MAG_BRIGHT = 1.5`, `MAG_FAINT = 10.5`, `RADIUS_CURVE = 0.85`.
  - Radius formula baseline: `radius = R_MIN + (R_MAX - R_MIN) * pow(clamp((MAG_BRIGHT - mag) / (MAG_BRIGHT - MAG_FAINT), 0, 1), RADIUS_CURVE)`.
- Any deviation from those values must be documented in the same turn that changes them, with a concrete regression reason.

## Milestones
1. Verify and, if needed, tighten the deep-star optics helpers without changing the physical gate.
   - Keep `passesScopeLimitingMagnitude` and the limiting-magnitude formulas unchanged.
   - Keep `computeScopeDeepStarEmergenceAlpha(deltaMag)` finite-safe and monotonic across the default band.
   - Keep `computeScopeDeepStarCoreRadiusPx(magnitude)` finite-safe and dependent only on magnitude, not aperture.
   - Do not narrow or remove existing `computeScopeRenderProfile` fields because shared consumers still validate the full shape.
2. Verify and, if needed, adjust `viewer-shell.tsx` deep-star mapping only.
   - Keep the current deep-star inclusion gate and physical filtering order unchanged.
   - Ensure the canvas mapper continues to derive `alpha` only from emergence and `radius` only from magnitude.
   - Keep deep-star stars fully saturated at `alpha = 1` once past the emergence band, with no extra aperture dimming after full emergence.
3. Keep the canvas renderer minimal and core-only.
   - Preserve `ScopeStarCanvasPoint` as the explicit `id/x/y/bMinusV/alpha/radius` contract used by the canvas.
   - Keep one core fill pass per star, retain B-V color mapping, and avoid canvas-side artistic reshaping beyond broad finite-safe bounds.
4. Lock behavior with regression-oriented tests.
   - Cover emergence monotonicity, continuity near band edges, and saturation to `1`.
   - Cover radius monotonicity and invariance across aperture changes.
   - Cover runtime deep-star mapping from loaded scope stars to canvas points.
   - Preserve no-halo expectations and ensure bright-object marker paths remain unaffected.

## Planned Interfaces
- `scope-optics.ts`
  - Preserve `computeScopeDeepStarEmergenceAlpha(deltaMag: unknown): number`.
  - Preserve `computeScopeDeepStarCoreRadiusPx(magnitude: unknown): number`.
  - Preserve `computeScopeRenderProfile(...)` and its full `ScopeRenderProfile` return shape for shared consumers.
- `viewer-shell.tsx`
  - Keep deep-star canvas mapping in the `scopeStarCanvasPoints` path, using `scopeRender.effectiveLimitMag - object.magnitude` for emergence and `computeScopeDeepStarCoreRadiusPx(object.magnitude)` for radius.
  - Keep `scopeRender` metadata attached for current marker/detail consumers and validator helpers.
- `scope-star-canvas.tsx`
  - Keep `ScopeStarCanvasPoint` as `{ id, x, y, bMinusV, alpha, radius }`.
  - Keep rendering to a single core arc using supplied color and alpha only.

## Regression Controls
- Invariants to preserve:
  - `passesScopeLimitingMagnitude` remains the authoritative pass/fail gate.
  - Stars that fail the gate remain excluded rather than partially rendered.
  - Aperture may change inclusion and emergence alpha, but must not change radius for a fixed magnitude.
  - Fully emerged stars must reach `alpha = 1` and keep existing B-V color mapping.
  - No halo path is reintroduced.
- Regression surfaces:
  - `ScopeRenderProfile` finiteness is validated in `viewer-shell.tsx` and unit tests, so removing or narrowing legacy fields would break unrelated scope behavior.
  - `ScopeStarCanvasPoint` is consumed through `scope-lens-overlay.tsx` and canvas/runtime tests.
  - `viewer-shell-scope-runtime.test.tsx` is the main regression surface for aperture/radius/alpha behavior and below-horizon exclusion.
  - Canvas-side over-clamping would flatten the requested magnitude-weighted size variation.

## Validation
- Run and pass at minimum:
  - `SkyLensServerless/tests/unit/scope-optics.test.ts`
  - `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - `SkyLensServerless/tests/unit/celestial-layer.test.ts`
  - Any directly impacted tests asserting `scopeRender` finiteness or scope metadata compatibility
- Validate these behaviors explicitly:
  - Emergence helper stays monotonic across `[-0.35, +0.75]`, returns `0` below band start, and saturates to `1` at or above band end.
  - Radius helper stays monotonic across the configured magnitude range and remains within the `1.0px` to `2.5px` baseline envelope.
  - Near-threshold stars fade in progressively instead of popping.
  - A fixed star magnitude produces the same deep-star core radius across aperture changes.
  - Fully emerged stars are not dimmed after they have crossed the emergence band.
  - Canvas still performs one fill pass per deep star with no halo regression.

## Compatibility / Rollback
- Compatibility:
  - No UI, persisted settings, control semantics, or scope tile selection behavior should change.
  - Keep the existing `scopeRender` metadata contract stable for marker/detail consumers.
- Rollback:
  - Revert only the deep-star helper/mapping/canvas behavior if tests show a visual or logical regression.
  - Do not roll back the limiting-magnitude gate or shared `scopeRender` compatibility path unless the user explicitly changes scope.

## Risk Register
- Risk: emergence alpha curve saturates too early or too late and makes threshold stars look incorrect.
  - Control: verify band-edge continuity and saturation in helper tests and runtime expectations.
- Risk: canvas-side safety bounds still flatten magnitude variation enough to miss the realism target.
  - Control: keep aesthetic shaping in the optics helper and keep canvas bounds broad only.
- Risk: changes made while tuning the deep-star path accidentally break bright-object marker/detail behavior through the shared `scopeRender` contract.
  - Control: preserve the full `ScopeRenderProfile` shape and keep regression coverage on scope metadata consumers.
