# Test Author ↔ Test Auditor Feedback

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: test
- Phase ID: overlay-ui-and-render-loop
- Phase Directory Key: overlay-ui-and-render-loop
- Phase Title: Overlay UI And Render Loop Integration
- Scope: phase-local authoritative verifier artifact

- Added `viewer-shell` regression coverage for relative-mode warning/status rendering, `requestAnimationFrame()` fallback ticking, and live `poseCalibration` synchronization through `SettingsSheet` fine-adjust/reset actions.
- Preserved and revalidated the broader phase coverage by running the full `tests/unit` suite after stabilizing the heavier live-mode cases with explicit per-test timeouts.

- Added viewer-shell regression coverage for the `requestAnimationFrame()` render-loop fallback and for fine-adjust/reset calibration actions syncing into persisted viewer settings plus the live orientation controller.
- Kept targeted calibration-target-priority, relative-sensor warning, and video-frame-metadata tests in scope; validated with `node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx` and a full `node_modules/.bin/vitest run tests/unit`.

- Added focused regression coverage for the viewer-shell relative-sensor warning/badge state and calibration guidance, alongside the existing per-frame metadata, settings persistence, and calibration-target priority tests.
- Validation run: `pnpm test -- --run tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell-celestial.test.ts` -> `17` files / `134` tests passed.

- Added viewer-shell regression coverage for relative-sensor warning/status UI and per-frame video metadata handling.
- Added celestial target-priority coverage for Sun → Moon → brightest planet → brightest star → north marker.
- Kept alignment-panel/FOV persistence coverage in settings-focused tests so demo/manual fallback remains test-locked.

- No blocking or non-blocking audit findings in the reviewed phase-local test scope after focused revalidation (`17` files / `134` tests passed).

- No blocking or non-blocking audit findings in the reviewed phase-local test scope.

- TST-001 | blocking | AC-1 is still not directly protected. `ViewerShell` computes marker/label positions from `projectWorldPointToScreen(...)` plus `cameraFrameLayout` and the calibrated pose in [viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx), but the current phase tests only assert frame-token advancement / `Frame 1920×1080` text in [viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts) and object-selection/label-presence behavior in [viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts). There is no assertion that a marker or label position/visibility changes correctly when non-viewport source dimensions or calibration are applied, so a regression where overlays ignore visible-video cropping or pose calibration would still pass. Add an integration test that renders a known object in live mode, drives per-frame metadata with non-trivial `sourceWidth/sourceHeight`, and asserts the resulting marker/label CSS position or visibility reflects the updated `cameraFrameLayout` and calibrated pose.

- Added `viewer-shell` regression coverage for the secure-context blocked screen and the absolute-sensor badge path so AC-2 now explicitly locks absolute, relative, manual, and failure-state UI distinctions. Revalidated with `pnpm test -- --run tests/unit/viewer-shell.test.ts`.


## System Warning (cycle 1)
No promise tag found, defaulted to <promise>INCOMPLETE</promise>.
