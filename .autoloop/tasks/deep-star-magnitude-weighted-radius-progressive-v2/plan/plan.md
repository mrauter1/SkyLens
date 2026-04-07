# Deep star magnitude-weighted radius + progressive aperture emergence plan

## Scope and baseline

- Implement only the PRD surface in `SkyLensServerless/lib/viewer/scope-optics.ts`, `SkyLensServerless/components/viewer/viewer-shell.tsx`, `SkyLensServerless/components/viewer/scope-star-canvas.tsx`, and the matching unit/runtime tests.
- Preserve the current physical visibility foundation exactly: `passesScopeLimitingMagnitude`, `computeScopeLimitingMagnitude`, current aperture/magnification/transparency controls, existing altitude suppression, and the current deep-star selection pipeline remain the gate for whether a star is considered renderable.
- Treat the current code as a narrow completion/tightening pass, not a redesign of the scope runtime. Reuse the existing helper and canvas-point path instead of introducing new rendering layers or abstractions.

## Milestone

### Complete astrophotography-style deep-star emergence without changing the physical gate

- Keep pass/fail scope filtering unchanged, but compute a progressive emergence alpha from `deltaMag = effectiveLimitMag - starMagnitude` so near-threshold stars fade in smoothly rather than popping in.
- Source deep-star core radius from magnitude only, with stable per-star size across aperture changes and no aperture-based size growth.
- Ensure fully emerged deep stars render at `alpha = 1` with their existing B-V color mapping and no extra dimming once the emergence curve saturates.
- Keep deep stars canvas-only and core-only; do not reintroduce halo rendering or pointer interaction paths.
- Remove or avoid any artistic alpha/radius attenuation in the deep-star path that would flatten the PRD’s intended variation, while keeping broad finite-safe guards against invalid values.

## Interfaces and invariants

- `SkyLensServerless/lib/viewer/scope-optics.ts`
  - Preserve `passesScopeLimitingMagnitude` and `computeScopeLimitingMagnitude` as the authoritative physical gate.
  - Keep or finalize `computeScopeDeepStarEmergenceAlpha(deltaMag)` using the PRD band defaults (`-0.35` to `+0.75`), smoothstep shaping, saturation to `0..1`, and finite-input fallback to `0`.
  - Keep or finalize `computeScopeDeepStarCoreRadiusPx(magnitude)` as a monotonic magnitude-to-radius mapping using the PRD defaults (`1.0..2.5px`, `MAG_BRIGHT=1.5`, `MAG_FAINT=10.5`, curve `0.85`), with finite-safe fallback and no optics input.
  - `computeScopeRenderProfile` may remain for existing metadata and non-deep-star behavior, but it must not control final deep-star radius or post-emergence dimming.

- `SkyLensServerless/components/viewer/viewer-shell.tsx`
  - Continue filtering deep stars through the existing scope eligibility path before any canvas-point emission.
  - Map each in-lens deep star to `ScopeStarCanvasPoint` with explicit `alpha` from the emergence helper and explicit `radius` from the magnitude-radius helper.
  - Keep named deep stars available for center-lock/detail behavior, but keep dense deep stars canvas-rendered and pointer-inert.
  - Do not couple aperture changes to `radius`; aperture only influences visibility/emergence through limiting magnitude.

- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
  - Render a single core arc per star from the supplied `radius`, `alpha`, and existing B-V color mapping.
  - Keep broad radius/alpha clamps for NaN/Infinity safety, but no halo, glow, or secondary intensity pass.

## Affected files

- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
- `SkyLensServerless/tests/unit/scope-optics.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`

## Validation

- Run the focused Vitest suites covering optics helpers, scope runtime mapping, and canvas rendering.
- Prove emergence alpha monotonicity, continuity around the band edges, and saturation to `1` above the upper threshold.
- Prove radius invariance across aperture changes for a fixed star magnitude.
- Prove viewer-shell mapping emits explicit canvas `alpha` and `radius` values while preserving the existing limiting-magnitude gate and below-horizon rejection.
- Prove the canvas remains single-pass core-only with unchanged color mapping and no halo path regressions.

## Regression controls

- Do not broaden the physical gate by replacing pass/fail filtering with alpha-only emergence; stars that fail the current limiting-magnitude gate must still be excluded from the deep-star list.
- Do not reuse `scopeRender.intensity`, aperture attenuation, or any other optics-derived dimming as the final deep-star alpha once a star is fully emerged.
- Do not change low-altitude suppression behavior, deep-star daylight suppression, scope controls, or lens interaction behavior as part of this task.
- Keep any safety clamps broad and defensive only; avoid reintroducing tight artistic clamps that collapse radius or alpha dynamic range.

## Compatibility, rollout, and rollback

- No UI migration, config migration, or persisted-data migration is expected; the control model and stored scope settings remain unchanged.
- Compatibility risk is limited to deep-star appearance and shared scope-render metadata consumers; implementation should keep `computeScopeRenderProfile` compatible for existing bright-object marker sizing and detail readouts.
- Roll back the helper/mapping/canvas/test changes as one unit if deep-star visibility, center-lock behavior, or bright-object scope rendering regresses, rather than partially reverting only one layer.

## Risk register

- Risk: Deep stars could disappear too early if the implementation incorrectly treats the emergence band as a replacement for the existing pass/fail gate.
  Mitigation: Preserve `passesScopeLimitingMagnitude` as the precondition for entering the deep-star render list and only apply emergence after that gate.
- Risk: Radius could drift with aperture if any remaining code path still reads render-profile size for deep stars.
  Mitigation: Centralize deep-star radius on the magnitude helper and cover aperture invariance in helper and runtime tests.
- Risk: Fully emerged stars could stay dim if the implementation multiplies emergence alpha by the old intensity/attenuation path.
  Mitigation: Use emergence alpha as the final deep-star alpha and validate saturation to `1` in tests.
- Risk: Canvas regressions could silently reintroduce halo/glow work or distort color mapping.
  Mitigation: Keep single-pass canvas assertions and explicit no-gradient/no-halo checks in the renderer tests.
