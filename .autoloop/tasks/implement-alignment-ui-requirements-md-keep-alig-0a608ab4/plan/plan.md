# Alignment UI Plan

## Scope
- Update alignment UX in `/workspace/SkyLens/components/viewer/viewer-shell.tsx`.
- Extend the calibration section in `/workspace/SkyLens/components/settings/settings-sheet.tsx`.
- Add or adjust focused unit coverage in `/workspace/SkyLens/tests/unit/viewer-shell.test.ts`, `/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts`, and `/workspace/SkyLens/tests/unit/viewer-settings.test.tsx`.
- Keep scope out of astronomy math, pose calibration math, and persisted storage unless implementation discovers a hard blocker.

## Current Gaps
- The mobile quick `Align` action is hidden after `viewerSettings.poseCalibration.calibrated` becomes `true`.
- Calibration guidance is limited to banner sentences; there is no explicit step-by-step flow visible on screen.
- `selectCalibrationTarget(sceneObjects)` auto-picks the target with no user override, and success/status copy is tied to the current scene target instead of the target actually used for alignment.

## Implementation Plan
### 1. Keep align available after success
- Remove the `!viewerSettings.poseCalibration.calibrated` visibility gate from the mobile quick action so `Align` remains available in live mode after successful calibration.
- Keep the existing disabled guard for cases where sensor alignment cannot run (`manual` mode or no live orientation sample).
- Preserve the current post-success behavior of leaving mobile alignment focus, but allow the visible quick action to re-enter alignment flow for re-alignment.

### 2. Add explicit on-screen calibration instructions
- Introduce a compact alignment instruction block that is visible during alignment-relevant states: relative sensors needing calibration, the explicit mobile alignment focus flow, and the settings calibration panel.
- Use ordered, explicit steps that tell the user what to do next: choose the target, center it in the reticle, tap `Align`, then fine-adjust or reset if labels still drift.
- Keep copy driven from shared viewer state so banners, instruction blocks, and settings panel guidance stay consistent.

### 3. Add a Sun/Moon target toggle
- Replace the single auto-selection call with a small resolver in `viewer-shell.tsx` that returns:
  - the effective calibration target,
  - whether Sun and Moon are currently available as selectable bodies,
  - the existing auto-fallback target when the requested body is unavailable.
- Add a session-scoped target preference in `ViewerShell` for Sun vs Moon selection. Do not change `ViewerSettings` storage for this request.
- Surface the toggle in the on-screen calibration UI and in the settings calibration panel with icon buttons, selected state, and unavailable/disabled treatment.
- Preserve the existing fallback order when the chosen body is unavailable: Sun, Moon, brightest visible planet, brightest visible star, then north marker.
- Capture the target label/source used at align time so success and calibrated-status copy reflect the applied target rather than drifting with later scene changes.

## Interface Changes
- `/workspace/SkyLens/components/viewer/viewer-shell.tsx`
  - add local alignment target preference and last-applied target display state,
  - replace `selectCalibrationTarget(objects)` with a resolver that also exposes Sun/Moon availability,
  - pass target-selection and instruction props into `SettingsSheet`.
- `/workspace/SkyLens/components/settings/settings-sheet.tsx`
  - extend props for selected target, target availability, selection handler, and explicit step copy,
  - render the Sun/Moon toggle and step instructions inside the existing calibration panel without changing unrelated settings controls.
- `/workspace/SkyLens/lib/viewer/settings.ts`
  - no planned schema or persistence changes.

## Validation
- Verify the live mobile quick `Align` action stays visible after a successful alignment and still re-enters alignment mode.
- Verify relative-sensor and alignment-focus UI render explicit steps that mention the active target.
- Verify selecting Moon overrides the default Sun-first target when both are visible, while unavailable selections fall back to the existing priority chain.
- Verify settings-sheet alignment controls still support align, reset, fine-adjust, and FOV controls after the new toggle/instruction content is added.
- Run targeted unit tests for viewer shell, celestial target resolution, and settings-sheet alignment UI.

## Compatibility And Risk Controls
- Compatibility: no persisted-data or routing contract changes are planned; the new target selection is session-scoped UI state only.
- Risk: success/status copy can become incorrect if it follows the current scene target.
  Control: store the target actually used at align time for post-alignment messaging.
- Risk: the new toggle could accidentally bypass the existing fallback chain.
  Control: keep fallback resolution in one viewer-shell resolver and cover unavailable-body cases in celestial tests.
- Risk: mobile overlay focus behavior can regress if alignment focus and quick actions change together.
  Control: keep the existing overlay/focus flow and only change align-action visibility plus the added instruction surface.
- Rollback: revert the resolver/toggle wiring and restore the previous quick-action visibility condition; no migration or storage cleanup is needed.
