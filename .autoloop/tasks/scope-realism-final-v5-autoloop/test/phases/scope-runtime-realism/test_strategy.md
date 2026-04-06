# Test Strategy

- Task ID: scope-realism-final-v5-autoloop
- Pair: test
- Phase ID: scope-runtime-realism
- Phase Directory Key: scope-runtime-realism
- Phase Title: Scope runtime rendering realism
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-3 deep-star core-only rendering:
  `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`
  Covers one-fill-per-star drawing, no gradient/halo path, compact radius clamp, deterministic alpha clamp, and unchanged B-V color mapping.
- AC-4 deep-star aperture dimness + preserved gate order:
  `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  Covers same-star alpha dimming at smaller aperture, below-horizon rejection, daylight suppression, and unchanged magnification-driven spacing behavior.
- AC-5 scope lens diameter runtime behavior:
  `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  Covers portrait-safe monotonic response for `scopeLensDiameterPct` at `50` and `90`.
  `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  Covers viewer-owned settings callback clamp and default rendered lens frame size.
- AC-6 extended-object scope realism:
  `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  Covers planet size increase with magnification plus opacity monotonicity for fixed aperture vs larger aperture.

## Preserved invariants checked
- Deep-star payload compatibility keeps `haloPx` while renderer ignores it.
- Existing deep-star inclusion order remains daylight -> horizon -> limiting magnitude -> render profile.
- Wide-view settings wiring for `scopeLensDiameterPct` remains normalized through the shared viewer-settings path.

## Edge cases / failure paths
- Invalid / huge `corePx` and `intensity` values clamp deterministically in `scope-star-canvas.test.tsx`.
- Portrait viewport saturation edge case is explicitly covered so supported lens percentages do not collapse to one size.
- Daylight-suppressed scope fetch path remains empty and does not request `.bin` tiles.

## Reliability / stabilization
- Canvas tests stub `getContext` and assert numeric draw calls directly instead of snapshotting pixels.
- Scope runtime tests use synthetic scope datasets and DOM style reads instead of timing-sensitive visual snapshots.
- `viewer-shell-celestial.test.ts` top-list and high-motion watchlist cases now force coarse timer control where the assertion is not about animation-frame semantics, avoiding environment-specific `requestAnimationFrame` flake.

## Known gaps
- No screenshot/golden-image coverage; visual fidelity remains encoded through deterministic canvas/DOM metrics.
- Extended-object sizing still uses local fallback angular baselines rather than dynamic transport data by design for this phase.
