# Deep Star Magnitude-Weighted Radius + Progressive Aperture Emergence (SkyLensServerless)

## Objective
Implement astrophotography-style deep-star rendering while preserving current scope visibility/filter logic.

## Mandatory decisions
1. Keep current visibility gate and filtering logic, including aperture/magnification/transparency/altitude limiting magnitude.
2. Keep current control model (aperture and magnification controls), and current star selection pipeline that determines stars physically visible for aperture.
3. Restore magnitude-weighted star core radius behavior (size based on star magnitude), not aperture-based size growth.
4. Use smooth progressive transparency emergence (100% to 0% transparency progressively as stars cross threshold), with regressive alpha near threshold.
5. Once star is fully emerged, render full brightness and real color (no extra dimming after full emergence).
6. Core-only rendering (no halo reintroduction for now).
7. Do not aesthetically soften low-altitude suppression; keep existing physical behavior.
8. Target aesthetic: astrophotography realism.

## Product Requirements (PRD)

### User experience goals
- As aperture increases, near-threshold stars appear progressively (soft fade-in), not abrupt pop-in.
- Deep stars show stronger and realistic size variation by magnitude.
- Star size remains stable for a given magnitude when changing aperture (aperture affects emergence/visibility, not radius).
- Fully emerged stars preserve accurate star color rendering.

### Functional requirements
- Preserve current limiting magnitude model and pass/fail baseline behavior from scope optics helpers.
- Add emergence alpha computation tied to delta between effective limiting magnitude and star magnitude.
- Integrate emergence alpha into deep-star canvas point generation.
- Replace current deep-star radius source with magnitude-weighted radius source.
- Remove artistic radius/intensity clamps that flatten visual variation, while retaining broad safety guards against invalid values.
- Ensure deep stars remain core-only in the canvas renderer.

### Non-goals
- No changes to scope control UI layout.
- No halo rendering.
- No aperture-based radius scaling.

### Acceptance criteria
1. Aperture increase causes smooth deep-star reveal for near-threshold stars.
2. No hard pop-in at threshold under nominal motion; stars can be nearly transparent before full emergence.
3. Radius for a star does not change with aperture when magnitude is fixed.
4. Fully emerged stars reach alpha=1 and retain intended color.
5. Existing limiting magnitude filtering remains active and functionally correct.
6. Unit tests cover emergence curve monotonicity/continuity, radius invariance against aperture, and render mapping behavior.

## Architecture Requirements (ARD)

### Target files
- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
- relevant unit tests in `SkyLensServerless/tests/unit/`

### Design constraints
- Keep existing `passesScopeLimitingMagnitude` and limiting magnitude formulas as the physical gate foundation.
- Add helper(s) for:
  - smooth emergence alpha from `deltaMag = effectiveLimitMag - starMag`
  - magnitude-to-radius mapping (core radius)
- In viewer-shell deep-star mapping, use those helpers to emit canvas points with explicit radius + alpha fields.
- Remove dependence on aperture attenuation helper for final star alpha if it conflicts with new emergence model.
- In canvas, render core arcs with supplied radius and alpha; keep color mapping intact.

### Suggested algorithmic defaults (tunable)
- Emergence band:
  - `EMERGE_START = -0.35`
  - `EMERGE_END = +0.75`
  - normalized `t = clamp((deltaMag - EMERGE_START)/(EMERGE_END-EMERGE_START), 0, 1)`
  - smoothstep and regressive exponent: `alpha = smoothstep(t)^1.35`
- Radius mapping:
  - smooth monotonic function from magnitude to radius
  - example: `radius = R_MIN + (R_MAX-R_MIN)*pow(clamp((MAG_BRIGHT-mag)/(MAG_BRIGHT-MAG_FAINT),0,1), RADIUS_CURVE)`
  - start defaults: `R_MIN=1.0`, `R_MAX=2.5`, `MAG_BRIGHT=1.5`, `MAG_FAINT=10.5`, `RADIUS_CURVE=0.85`

### Safety requirements
- Keep robust fallback handling for invalid numbers (no NaN/Infinity rendering state).
- Keep broad safety guards for radius/alpha bounds but avoid aggressive artistic clamps that collapse dynamic range.

### Testing requirements
- Add/adjust unit tests for:
  - emergence alpha monotonicity and continuity
  - alpha saturation to 1 for sufficiently positive delta
  - radius invariance with aperture changes
  - integration mapping from deep-star object -> canvas point fields
  - no halo rendering path regressions

## Execution requirements for autoloop
- Run with `plan,implement,test` pairs.
- Use full auto answers.
- Do not set max_iterations.
- Do not skip tests.
- Implement only via autoloop workflow.
