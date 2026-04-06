# Implementation Notes

- Task ID: autoloop-task-implement-skylensserverless-scope-05c699dd
- Pair: implement
- Phase ID: compact-deep-star-render-retune
- Phase Directory Key: compact-deep-star-render-retune
- Phase Title: Compact deep-star canvas retune
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
- `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`

## Symbols touched
- `ScopeStarCanvas`
- `normalizeScopeStarRadiusPx`
- `getLensCompressionFactor`
- `compressRadius`
- `getScopeStarHaloFill`
- `withScopeStarAlpha`

## Checklist mapping
- Plan item `add local pure helpers`: completed with `getLensCompressionFactor` and `compressRadius`.
- Plan item `compress incoming corePx/haloPx into compact envelopes`: completed with core clamp `0.9-2.2` px and halo clamp `1.4-3.6` px.
- Plan item `switch halo pass to radial gradient with transparent edge`: completed with deterministic solid-fill fallback.
- Plan item `draw halo only above deterministic core threshold`: completed with `1.15` px compressed-core threshold.
- Plan item `expand scope-star-canvas.test.tsx`: completed for gradient creation, stop ordering, envelope clamping, halo suppression, fallback, and color semantics.
- Plan item `update viewer-shell-scope-runtime.test.tsx only if needed`: intentionally not changed because focused and broader runtime suites passed unchanged.

## Assumptions
- `diameterPx` remains finite during normal rendering; non-finite values fall back to a mobile-sized compression baseline.
- Existing profile normalization to `0.8-6.2` px remains the pre-compression sanitization step.

## Preserved invariants
- `scopeOptics.magnificationX` ownership and optics filtering remain unchanged.
- Deep-star gating order remains unchanged because the renderer is the only runtime code touched.
- `bMinusV` color mapping strings remain unchanged for the core pass.
- Intensity response remains monotonic through existing halo/core opacity functions.

## Intended behavior changes
- Deep-star core/halo radii are diameter-aware and compacted for small lens canvases.
- Halo rendering now uses a radial gradient with center alpha and zero edge alpha.
- Halos are skipped when the compressed core radius is below `1.15` px to avoid fuzzy tiny stars.

## Known non-changes
- No edits to `scope-optics`, catalog resolution, deployment scripts, or runtime gating logic.
- No `.bin` assets or snapshot tests added.

## Expected side effects
- Small/mobile scope lenses render less bloated deep-star halos while keeping brighter stars slightly larger than dimmer ones.
- Environments without gradient support still draw deterministic halos as solid fills.

## Validation performed
- `npm ci`
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-lens-overlay.test.tsx`

## Deduplication / centralization
- Radius compression and gradient fallback remain local to `scope-star-canvas.tsx` to avoid leaking renderer tuning into optics/runtime modules.
