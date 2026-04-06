# Autoloop Task: Implement SkyLensServerless Scope Deep-Star Render Quality v3

Implement the PRD/ARD defined in:
- `SkyLensServerless-Scope-Deep-Star-Render-Quality-v3.md`

## Required execution mode
- Use full auto answers.
- Use pairs: `plan,implement,test`.
- Do not set max iterations.

## Primary objective
Implement the deep-star visual-quality update in **SkyLensServerless** so stars are compact and crisp at mobile lens sizes while preserving optics semantics.

## Scope and constraints
- In scope files (minimum):
  1. `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
  2. `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`
  3. `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx` (if needed)
- Keep `scopeOptics.magnificationX` canonical.
- Preserve deep-star gating order and optics runtime semantics.
- Keep two-pass rendering but make halo radial gradient.
- Apply lens-diameter-aware radius compression for compact rendering.
- Do not add `.bin` files.
- Do not modify deployment scripts or catalog source resolution.

## Rendering requirements
- Add local pure helpers in `scope-star-canvas.tsx`:
  - `getLensCompressionFactor(diameterPx)` (clamped range around [0.72, 1.0])
  - `compressRadius(radiusPx, compressionFactor, min, max)`
- Use profile inputs and compress+clamp into compact envelopes:
  - Core target around `[0.9, 2.2]`
  - Halo target around `[1.4, 3.6]`
- Halo must be radial gradient:
  - center alpha = tuned halo alpha
  - edge alpha = 0
- Draw halo only when core radius >= threshold (recommended start 1.15).
- Draw core pass always as solid fill.
- Deterministic fallback: if gradient creation fails, render solid halo fill with tuned alpha.
- Keep monotonic intensity response.

## Tests (required)
Update/add tests for:
1. Gradient creation called.
2. Gradient color stops include center and edge with monotonic falloff.
3. Core/halo radii are compressed/clamped into compact envelopes.
4. Halo disabled below core threshold.
5. Gradient-failure fallback still renders deterministically.
6. Existing color semantics unchanged.

Runtime tests must continue to validate:
- optics limiting magnitude filtering,
- below-horizon rejection,
- magnification-driven spacing behavior.

## Validate commands
Run at minimum:
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`

If stable, run broader pack:
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-lens-overlay.test.tsx`

## Delivery expectations
- Commit code and tests.
- Ensure no binary artifacts.
- Provide clear summary of tuned envelopes and test results.
