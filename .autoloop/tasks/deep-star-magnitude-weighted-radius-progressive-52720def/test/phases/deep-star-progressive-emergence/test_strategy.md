# Test Strategy

- Task ID: deep-star-magnitude-weighted-radius-progressive-52720def
- Pair: test
- Phase ID: deep-star-progressive-emergence
- Phase Directory Key: deep-star-progressive-emergence
- Phase Title: Deep-Star Emergence And Radius Rework
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-1 / preserved gate behavior:
  - `tests/unit/scope-optics.test.ts`
  - `retains threshold stars monotonically as aperture, transparency, and altitude improve`
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - `rejects below-horizon deep stars while retaining optics-eligible stars`
- AC-2 / progressive emergence alpha:
  - `tests/unit/scope-optics.test.ts`
  - `progressively emerges deep stars with a monotonic smooth alpha curve`
  - mid-band alpha remains partial (`0 < alpha < 1`) before saturation
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - `progressively reveals deep stars as aperture increases while keeping radius fixed`
- AC-3 / magnitude-derived radius, aperture invariance:
  - `tests/unit/scope-optics.test.ts`
  - `maps deep-star core radius from magnitude without aperture coupling`
  - multi-sample radius ordering stays monotonic from bright to faint and remains inside the `1.0px` to `2.5px` envelope
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - `progressively reveals deep stars as aperture increases while keeping radius fixed`
  - `renders brighter deep stars with larger canvas radii than dimmer deep stars`
- AC-4 / core-only canvas path and preserved color mapping:
  - `tests/unit/scope-star-canvas.test.tsx`
  - `draws one compact core per star while preserving B-V color semantics`
  - `falls back to a 1px core radius for invalid radius inputs without adding halos`
  - `clamps undersized radii to the broad finite-safe lower bound without adding halos`
  - `renders a single core fill pass from explicit radius and alpha`
  - `clamps core alpha deterministically without a halo path`
  - `keeps B-V color mapping unchanged across the existing ranges`
  - `tests/unit/scope-lens-overlay.test.tsx`
  - `renders a clipped circular pointer shield with no focusable descendants`

## Preserved invariants checked
- `passesScopeLimitingMagnitude` remains the inclusion gate; stars below the horizon or below the optics limit remain excluded.
- Deep-star canvas alpha is emergence-driven and saturates to `1`.
- Deep-star radius is stable for a fixed magnitude when aperture changes.
- Canvas remains core-only with no gradient/halo rendering path.
- B-V color mapping remains unchanged.

## Edge cases and failure paths
- Malformed optics, malformed magnitude inputs, and malformed alpha/radius inputs stay finite-safe.
- Emergence curve boundary checks cover just-below and just-above the configured band edges.
- Radius mapping clamps bright-outlier and faint-outlier magnitudes to the expected envelope and remains monotonic across a broader bright-to-faint sample.
- Canvas safety bounds clamp oversized radius, clamp undersized radius to `0.8px`, fall back invalid radius to `1px`, and clamp invalid alpha without reintroducing halos.

## Flake risks / stabilization
- Runtime deep-star tests use deterministic synthetic scope datasets and mocked fetch responses.
- Canvas assertions rely on stubbed 2D contexts and explicit `act()` boundaries rather than timing-sensitive DOM painting.
- Scoped phase validation is runnable in this checkout through `npx vitest`; keep the command rooted at `SkyLensServerless/` and use `tests/unit/...` paths so Vitest matches the configured include glob.

## Known gaps
- This phase reran only the scoped deep-star slice (`scope-optics`, `scope-star-canvas`, `viewer-shell-scope-runtime`, and `celestial-layer`); broader suite coverage remains outside this phase turn.
