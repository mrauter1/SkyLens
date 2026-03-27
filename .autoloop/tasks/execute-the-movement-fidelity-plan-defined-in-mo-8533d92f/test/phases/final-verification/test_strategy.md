# Test Strategy

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: test
- Phase ID: final-verification
- Phase Directory Key: final-verification
- Phase Title: Run final validation
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Cadence loop:
  `tests/unit/viewer-shell.test.ts`
  `advances demo scene time continuously with the animation-driven cadence`
  `keeps live scene time synced to wall clock under the animation cadence`
  `falls back to the coarse scene cadence when animation frames are unavailable`
  the low-quality cadence path and reduced-motion fallbacks remain covered in the same suite.
- Aircraft temporal continuity:
  `tests/unit/aircraft-layer.test.ts`
  `interpolates aircraft motion between retained snapshots during the transition window`
  `suppresses aircraft once stale data ages beyond the bounded fallback window`
  `downgrades stale aircraft before suppressing them completely`
  `keeps fresh current-only aircraft live during entry fade when motion fields are absent`
  `keeps departing aircraft briefly visible while they fade out of the snapshot set`
  plus `tests/unit/viewer-shell.test.ts` coverage for retained/current snapshot handling and live-refresh failure retention.
- Shared motion state:
  `tests/unit/viewer-motion.test.ts`
  covers estimated aircraft prediction, stale confidence decay, deterministic satellite propagation, stale satellite downgrade, and id preservation through `resolveMovingSkyObjects`.
  `tests/unit/viewer-shell-celestial.test.ts`
  covers aircraft/satellite failure isolation and label-selection behavior at the viewer layer.
- Motion affordances and quality controls:
  `tests/unit/viewer-settings.test.tsx`
  covers default/persisted `motionQuality`.
  `tests/unit/settings-sheet.test.tsx`
  covers the motion-quality UI control.
  `tests/unit/viewer-shell-celestial.test.ts`
  covers low-quality vector behavior, balanced/high trails, and reduced-motion trail suppression.
  `tests/unit/viewer-shell.test.ts`
  covers stale/estimated motion labels and badges for moving objects.

## Preserved invariants checked
- Absolute-sensor startup still reports absolute motion/sensor status.
- Camera picker reopening still works when switching back to auto rear-camera selection.
- Object ids, additive stale/estimated treatment, and moving-layer failure isolation remain intact.
- Reduced-motion continues to suppress motion-heavy affordances even when motion quality is not `low`.

## Edge cases and failure paths
- Live aircraft refresh failure retains the last successful snapshot temporarily instead of dropping markers immediately.
- Stale aircraft and stale satellite cache paths degrade visually before suppression.
- Missing animation-frame support and reduced-motion preference keep the coarse cadence active.
- Live viewer remains usable if either aircraft or satellite resolution throws independently.

## Flake-risk control
- Timing-sensitive viewer-shell tests use fake timers, mocked animation-frame clocks, and explicit `flushEffects()`/`act()` boundaries.
- Motion-policy tests use fixed timestamps and fixtures so confidence decay and propagated coordinates stay deterministic.

## Known gaps
- This phase did not add new repository test cases because the final verification changes were already pinned by existing `viewer-shell` regressions and the repo-wide `npm run lint` / `npm run test` reruns passed on the validated change set.
