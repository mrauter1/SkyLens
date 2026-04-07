# Test Strategy

- Task ID: deep-star-magnitude-weighted-radius-progressive-v2
- Pair: test
- Phase ID: deep-star-emergence-alignment
- Phase Directory Key: deep-star-emergence-alignment
- Phase Title: Deep Star Emergence Alignment
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Deep-star emergence helper continuity, monotonicity, and saturation:
  covered in `SkyLensServerless/tests/unit/scope-optics.test.ts`
  checks invalid-input fallback, monotonic rise across the PRD band, positive threshold alpha at `deltaMag = 0`, and saturation at/above the upper bound.
- Magnitude-only core radius mapping:
  covered in `SkyLensServerless/tests/unit/scope-optics.test.ts`
  checks finite-safe fallback, boundary values, monotonic decrease with fainter magnitudes, and bounded output range with no optics input.
- Viewer-shell deep-star canvas mapping:
  covered in `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  checks below-horizon rejection, preserved limiting-magnitude gate exclusion, aperture-driven emergence alpha change, helper-derived `alpha`/`radius` mapping, aperture-invariant radius, and brighter-vs-dimmer radius ordering.
- Core-only canvas rendering / no halo path:
  covered in `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`
  checks single-pass core rendering, unchanged B-V color mapping, broad finite-safe alpha/radius clamps, fallback handling for invalid radius, and explicit absence of gradient/halo work.

## Preserved invariants checked

- `passesScopeLimitingMagnitude` remains the physical gate before any progressive emergence alpha is applied.
- Deep-star radius stays determined only by magnitude.
- Deep stars remain canvas-only and core-only.
- Existing altitude and daylight suppression behavior stays unchanged in the covered runtime paths.

## Edge cases

- Invalid helper inputs (`NaN`, non-finite values) fall back safely.
- Near-band-edge emergence values stay continuous and bounded.
- Canvas radius normalization covers both oversized and undersized inputs.

## Failure paths

- Below-horizon deep stars are excluded from canvas output.
- Over-limit deep stars are excluded by the preserved physical gate.
- Invalid alpha/radius values in canvas input are clamped or defaulted without adding halos.

## Flake risk / stabilization

- Runtime tests use the deterministic `tokyo-iss` demo scenario plus synthetic scope-tile fixtures.
- Canvas behavior is asserted through a stubbed 2D context to avoid browser rendering variance.
- No live network or wall-clock dependency is used in the covered tests.

## Known gaps

- No pixel-diff or visual snapshot coverage; renderer verification remains behavior-level via canvas call assertions.
