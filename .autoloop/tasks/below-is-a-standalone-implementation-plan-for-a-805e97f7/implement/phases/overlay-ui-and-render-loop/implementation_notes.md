# Implementation Notes

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: implement
- Phase ID: overlay-ui-and-render-loop
- Phase Directory Key: overlay-ui-and-render-loop
- Phase Title: Overlay UI And Render Loop Integration
- Scope: phase-local producer artifact

## Files changed

- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- `lib/sensors/orientation.ts`
- `lib/viewer/settings.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-settings.test.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`

## Symbols touched

- `SettingsSheet`
- `ViewerShell`
- `subscribeToOrientationPose()`
- `buildSceneSnapshot()`
- `selectCalibrationTarget()`
- `describeCalibrationStatus()`
- `getSensorStatusValue()`
- `ViewerSettings`
- `requestVideoFrameCallback` viewer test shim / render-tick assertions

## Checklist mapping

- Plan item 5 / active phase AC-3: replaced persisted scalar heading/pitch trim usage with persisted quaternion `poseCalibration`, wired align/reset/fine-adjust mutations through the live sensor controller, and kept legacy offset fields read-only for backward compatibility.
- Plan item 6 / active phase AC-1: projected labels and constellation overlay now consume the calibrated quaternion pose plus the live `cameraFrameLayout` while the render cadence is driven from video-frame callbacks or RAF.
- Plan item 8 / active phase AC-2: surfaced explicit sensor/mode badges and calibration/relative-mode banners in both desktop and mobile overlay shells.
- Plan item 9 / active phase AC-4: added deterministic calibration target selection in the required priority order with a manual north-marker fallback and exposed it in the alignment panel.

## Assumptions

- Demo/manual modes should still open the calibration panel so FOV and camera controls remain reachable, even though only sensor mode applies calibration mutations.
- Existing astronomy providers and object metadata remain authoritative for target selection; no new ranking/data source was introduced.

## Preserved invariants

- Demo mode remains route-driven and keeps manual pan behavior.
- Camera device persistence, manual observer fallback, and live startup ownership stay in `ViewerShell`.
- Rear-camera usage stays inline and `audio: false`.

## Intended behavior changes

- The viewer now persists quaternion calibration instead of viewer-side heading/pitch nudges.
- Live overlay rendering now has a per-frame render tick separate from the slower astronomy snapshot cadence.
- Alignment UI now shows calibration target, reset, and quaternion fine-adjust controls instead of raw heading/pitch sliders.
- The Alignment panel can still be opened in demo/manual fallback modes so FOV calibration and camera selection are not hidden when sensor calibration actions are unavailable.

## Known non-changes

- No new astronomy datasets or target-ranking subsystem were added.
- Fine adjustment is exposed as quaternion nudge controls in the settings/alignment panel; broader gesture-specific calibration UX remains for a later pass if needed.

## Expected side effects

- Older saved settings payloads still load, but their legacy heading/pitch values no longer affect live alignment.
- Relative orientation sessions now surface explicit alignment-required state and suggested calibration target copy.

## Validation performed

- `pnpm test -- --run tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx`
- `pnpm test -- --run tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`

## Deduplication / centralization

- Calibration target selection and status text are centralized inside `ViewerShell` helper functions.
- `subscribeToOrientationPose()` now exposes `setCalibration()` so viewer-owned persistence and live sensor state stay synchronized without duplicating pose math outside `lib/sensors/orientation.ts`.
