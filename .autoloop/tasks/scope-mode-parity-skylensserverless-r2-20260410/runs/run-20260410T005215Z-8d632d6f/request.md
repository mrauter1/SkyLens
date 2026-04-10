# Scope Mode Parity Task (SkyLensServerless)

## Objective
Implement scope-mode parity so **scope mode shows the same classes of sky elements as normal view** (constellations, satellites, aircraft, stars, etc.), while still applying **scope-specific aperture/magnification optics**.

## Required outcomes
1. In scope mode (`skylensserverless` scope mode), object-class visibility parity with normal view is restored.
2. Scope optics remain distinct from normal view (projection, FOV, and magnification behavior should remain scope-specific).
3. Labels/top-list candidate sets in scope mode include the same relevant classes as normal mode (not only bright objects + deep stars).

## Issues to address
### Issue 1 — Scope lens excludes non-bright object types
- Current scope overlay object derivation uses `scopeProjectedBrightObjects` via `isScopeBrightObject()` and excludes non-bright classes.
- Result: satellites and other markers disappear in scope pipeline.

### Issue 2 — Scope mode uses main-view sizing/projection baseline
- Marker sizing in scope mode still references `baseEffectiveVerticalFovDeg` in `getMarkerSizePxForEffectiveVerticalFovDeg(...)`.
- Stage markers are derived from normal-view projection objects.
- Result: apparent scale/projection mismatch relative to scope optics.

### Issue 3 — Scope labels/top-list restricted to bright objects + deep stars
- `labelObjects` in scope mode currently pulls from `scopeActiveBrightObjects` + deep stars.
- Result: labels/top-list suppress satellites and other classes that appear in normal mode.

## Implementation strategy
1. Build a shared marker-eligible object resolver used by both normal and scope branches.
2. Split projection cleanly into stage vs lens variants.
3. Rewire lens markers + labels to use the scope marker set with parity classes.
4. Use active optics/FOV consistently in scope mode for marker sizing and visibility.

## Constraints
- Preserve existing normal-view behavior.
- Keep scope mode optics behavior distinct and coherent.
- Keep changes focused and test-backed.

## Execution mode
Run with autoloop in **full-auto answers** mode, using **plan, implement, test** pairs.
