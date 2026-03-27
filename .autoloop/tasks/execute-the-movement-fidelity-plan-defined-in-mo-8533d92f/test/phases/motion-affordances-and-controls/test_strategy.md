# Test Strategy

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: test
- Phase ID: motion-affordances-and-controls
- Phase Directory Key: motion-affordances-and-controls
- Phase Title: Add motion affordances and quality controls
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Persisted `motionQuality` defaults cleanly for pre-upgrade settings payloads:
  covered in `tests/unit/viewer-settings.test.tsx` by direct `readViewerSettings()` assertions against stored settings that omit `motionQuality`, plus ViewerShell integration that confirms the `Balanced` control is selected on load.
- Motion quality persists across user changes and reloads:
  covered in `tests/unit/viewer-settings.test.tsx` by switching to `High`, asserting persisted settings, remounting, and verifying the radio state survives reload.
- Settings sheet exposes low / balanced / high controls:
  covered in `tests/unit/settings-sheet.test.tsx` by opening the real sheet and asserting the motion-quality change callback fires for `High`.
- Low quality uses reduced motion-affordance fidelity:
  covered in `tests/unit/viewer-shell-celestial.test.ts` by asserting `low` renders `motion-affordance-vector` and not `motion-affordance-trail`.
- Balanced quality renders a trail instead of the low-quality vector:
  covered in `tests/unit/viewer-shell-celestial.test.ts` by asserting `balanced` renders `motion-affordance-trail` and not the vector.
- High quality also stays on the trail-based affordance path:
  covered in `tests/unit/viewer-shell-celestial.test.ts` by asserting `high` renders `motion-affordance-trail` and not the vector.
- Reduced-motion preference suppresses affordances regardless of quality:
  covered in `tests/unit/viewer-shell-celestial.test.ts` by enabling `prefers-reduced-motion` and asserting both affordance elements stay absent.
- Stale / extrapolated moving-object visuals remain additive and readable:
  covered in `tests/unit/viewer-shell.test.ts` for stale aircraft and stale satellite label/opacity behavior, and in `tests/unit/viewer-shell-celestial.test.ts` for the stale ISS combined badge state.
- Shared motion metadata for stale satellite catalogs:
  covered in `tests/unit/viewer-motion.test.ts` by asserting stale catalogs yield `motionState='stale'` and downgraded confidence/opacity.
- Preserved battery-conscious cadence behavior for `motionQuality='low'`:
  covered in `tests/unit/viewer-shell.test.ts` by asserting low quality stays on the coarse cadence path.

## Preserved invariants checked
- Settings storage key compatibility and missing-field upgrade behavior remain intact.
- Reduced-motion still overrides motion-affordance rendering.
- Existing ISS-specific badge affordance remains present when stale state is added.

## Edge cases and failure paths
- Missing `motionQuality` in persisted settings.
- Stale TLE catalog metadata.
- Stale ISS combining old and new badge affordances.
- Reduced-motion suppression path.

## Flake risks and stabilization
- Motion-affordance DOM tests use mocked timers / controlled waits and explicit `data-testid` selectors to avoid relying on incidental text or animation timing.
- Settings persistence tests read local storage directly after deterministic UI events and remounts instead of depending on asynchronous network state.

## Known gaps
- The phase tests do not currently assert exact retained trail sample counts for `balanced` versus `high`; they now pin all three quality-mode render paths plus persistence/suppression behavior, but not the precise balanced-vs-high history-cap distinction.
