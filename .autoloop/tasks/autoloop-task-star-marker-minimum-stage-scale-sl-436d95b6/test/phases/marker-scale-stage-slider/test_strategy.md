# Test Strategy

- Task ID: autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6
- Pair: test
- Phase ID: marker-scale-stage-slider
- Phase Directory Key: marker-scale-stage-slider
- Phase Title: Add persisted marker scale and star minimum sizing
- Scope: phase-local producer artifact

## Behavior-to-Test Coverage

- Persisted marker scale defaults/clamps:
  `tests/unit/viewer-settings.test.tsx`
  Covers legacy saved settings defaulting `markerScale` to `1`, persisting decimal values such as `2.4`, and clamping both out-of-range bounds (`0 -> 1`, `9 -> 4`) on reload.
- Live mobile slider wiring:
  `tests/unit/viewer-shell.test.ts`
  Covers the `Marker scale` control rendering above the quick-action buttons, visible numeric feedback, slider value updates, and persistence through the shared viewer settings path.
- Marker-size math at scale 1:
  `tests/unit/viewer-shell-celestial.test.ts`
  Covers dim stars rendering at `1px`, representative non-dim stars preserving their previous scale-1 size, and brighter objects remaining larger than dim stars.
- Marker-size math at scale 4:
  `tests/unit/viewer-shell-celestial.test.ts`
  Covers proportional scaling from scale-1 results, including `1px` dim stars becoming `4px` and non-star floor-constrained markers becoming `24px`.

## Preserved Invariants Checked

- Non-star marker floors remain `6px` at scale `1`.
- Stars above the former floor retain their prior rendered size at scale `1`.
- The slider remains scoped to the mobile quick-action dock and uses shared viewer settings persistence.

## Edge Cases

- Legacy persisted settings without `markerScale`.
- Saved `markerScale` values above and below the supported range.
- Extreme dim-star case that previously floor-clamped at `6px`.
- Wide-FOV non-star floor case combined with `markerScale = 4`.

## Failure Paths / Regression Risks

- Persistence normalization drift that would let invalid saved values bypass the `1..4` clamp.
- A future star-sizing refactor that shrinks normal stars instead of only relaxing the old floor-clamped band.
- Mobile quick-action layout regressions that move the slider out of the requested control area.

## Stabilization Notes

- Tests stay deterministic by using mocked celestial/motion inputs, direct localStorage setup, and synthetic input events instead of timers or network-dependent flows.

## Known Gaps

- No end-to-end browser coverage was added in this phase; the current safety net is the focused unit suite around settings, stage wiring, and marker-size rendering.
