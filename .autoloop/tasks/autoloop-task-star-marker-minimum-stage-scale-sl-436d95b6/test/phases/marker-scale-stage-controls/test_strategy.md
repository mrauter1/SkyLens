# Test Strategy

- Task ID: autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6
- Pair: test
- Phase ID: marker-scale-stage-controls
- Phase Directory Key: marker-scale-stage-controls
- Phase Title: Implement marker scale setting and star minimum sizing
- Scope: phase-local producer artifact

## Behavior-to-test map
- Star minimum sizing at scale `1`: [tests/unit/viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts) asserts a dim star renders at `1px`.
- Preserved scale-`1` sizing for ordinary stars: the same celestial test asserts a mid-bright star still renders at `7px`.
- Preserved non-star minimum at scale `1`: the same celestial test asserts a dim satellite still renders at `6px`.
- Live stage slider updates: the celestial slider test changes `mobile-marker-scale-slider` from `1` to `4` and checks the marker size updates to `4px` immediately.
- Persisted slider state: the celestial slider test remounts `ViewerShell` after moving the slider and asserts the slider/value/marker hydrate back to `4`.
- Viewer settings normalization: [tests/unit/viewer-settings.test.tsx](/workspace/SkyLens/tests/unit/viewer-settings.test.tsx) asserts missing `markerScale` defaults to `1` and out-of-range persisted values clamp into `1..4`.

## Preserved invariants checked
- `markerScale` remains the single persisted source of truth.
- Scale `1` behavior is unchanged for non-star markers and for stars already above the former `6px` floor.
- Scale `4` multiplies the scale-`1` marker size without reopening settings UI.

## Edge cases
- Extremely dim stars that previously collapsed to the old floor.
- Older localStorage payloads missing `markerScale`.
- Out-of-range persisted `markerScale` values above `4` and below `1`.

## Failure paths
- Invalid persisted `markerScale` values are normalized instead of leaking bad state into the viewer.
- Motion-affordance timing in the celestial suite is stabilized by allowing the initial low-quality vector to be absent or zero-length before scene time advances.

## Known gaps
- The test phase does not add desktop-layout coverage because the phase contract keeps the control scoped to the mobile quick-actions block.

## Behavior-to-test map
- Star minimum sizing at scale `1`:
  covered in `tests/unit/viewer-shell-celestial.test.ts`
  checks a dim star renders at `1px`
- Preserved scale-1 sizing for ordinary stars:
  covered in `tests/unit/viewer-shell-celestial.test.ts`
  checks a mid-bright star still renders at its prior `7px` size
- Preserved non-star minimum at scale `1`:
  covered in `tests/unit/viewer-shell-celestial.test.ts`
  checks a far satellite remains at `6px`
- Live stage slider updates:
  covered in `tests/unit/viewer-shell-celestial.test.ts`
  checks the quick-actions slider value text and marker size update from `1.0x` / `1px` to `4.0x` / `4px`
- Persisted marker scale hydration:
  covered in `tests/unit/viewer-shell-celestial.test.ts` and `tests/unit/viewer-settings.test.tsx`
  checks `readViewerSettings().markerScale` updates after slider interaction and survives an unmount/remount
- Backward-compatible settings reads and bounds:
  covered in `tests/unit/viewer-settings.test.tsx`
  checks missing `markerScale` defaults to `1` and out-of-range persisted values clamp to `1..4`

## Preserved invariants checked
- Marker scale is applied after the scale-1 size is chosen.
- Stars above the old `6px` floor keep their legacy size curve at scale `1`.
- Non-star marker floors remain unchanged at scale `1`.

## Edge cases
- Extremely dim stars that would previously collapse to the old floor now reach `1px`.
- Reload-equivalent hydration is exercised through deterministic unmount/remount instead of a browser reload.
- Out-of-range persisted `markerScale` values are normalized without breaking older storage payloads.

## Failure paths / stabilization
- Persistence checks avoid network or timer dependence by using localStorage-backed reads and component remounts inside the same test process.
- Slider interaction uses the existing `setInputValue` helper so DOM event sequencing stays deterministic across JSDOM runs.

## Known gaps
- No separate desktop-only test was added because the requested control surface is explicitly the mobile stage quick-actions block and the shared persistence path is already covered.
