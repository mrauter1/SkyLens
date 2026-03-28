# SkyLens Alignment UX / Mobile Camera Hardening Plan

## Scope
- Primary files: `components/viewer/viewer-shell.tsx`, `lib/viewer/alignment-tutorial.ts`
- Shared fallout to check: `components/settings/settings-sheet.tsx`
- Test coverage to update: `tests/unit/viewer-shell.test.ts`, `tests/unit/viewer-shell-celestial.test.ts`, `tests/unit/settings-sheet.test.tsx`

## Current State
- Live/mobile viewer still uses a fullscreen `overflow-y-auto` overlay, so AR usage can scroll instead of staying locked to the camera stage.
- The live alignment panel auto-renders from relative-sensor and drift states via `shouldShowAlignmentInstructions`, so it does not start closed.
- Fast alignment copy is modeled as a full ordered `instructions` list and still references reset-before-retry behavior.
- The center reticle is visual-only today; applying alignment is still driven by the separate Align button.
- Re-entry into alignment already exists after calibration, but the focus/panel state still auto-closes based on `poseCalibration.calibrated` and the copy implies reset is part of the retry path.

## Milestones
### 1. Harden live viewer interaction and alignment state
- Introduce an explicit live alignment-panel/focus state in `ViewerShell` that defaults closed.
- Open that state only from a single Align action.
- Rework any existing settings-sheet alignment launcher so it no longer acts as a second independent opener; it must either invoke the same Align semantics or stop opening the live fast-align panel directly.
- Add an explicit dismiss/close control for the live alignment panel/focus state.
- Stop using `startupState === 'sensor-relative-needs-calibration'` and `showAlignmentGuidance` as auto-open triggers; keep those states as warning/status banners only.
- Lock `document.body` and `document.documentElement` scrolling only while the active live camera stage/alignment-focus AR experience is on screen, with cleanup that restores prior styles.
- Preserve normal page/sheet scrolling for blocked, permission-recovery, and non-camera live states so warning/recovery content remains reachable on small screens.
- Remove or redesign the mobile fullscreen scroll region so the AR flow no longer depends on `overflow-y-auto`.
- Preserve the stage gesture path (`touch-none`, pointer drag handlers, manual panning) and ensure overlay controls only consume pointer events where intentional.

### 2. Convert fast alignment into a single next-action flow
- Narrow the fast/live alignment contract from a multi-step list to concise fields for:
  - current status,
  - essential warnings/fallback notices,
  - one next-action message,
  - one focus-mode prompt for the center tap target,
  - align action labeling that supports immediate re-entry.
- Keep target selection and fine-adjust controls available if they remain part of the existing live panel, but remove reset-as-required wording from the fast flow.
- Keep calibration math and target resolution behavior unchanged unless required to wire the center-tap affordance.
- In alignment focus mode, make the centered reticle the apply-align hit target, preserve its geometry, restyle it to translucent green, and add top-of-screen guidance telling the user to press/tap the middle of the screen.
- After a successful apply, return to the normal viewer state while leaving Align available so the user can re-open and re-align again without resetting first.

### 3. Update regression coverage and run targeted validation
- Replace tests that assert the ordered step list/reset-first copy with assertions for the new next-action-only fast flow.
- Add coverage for:
  - alignment panel closed-by-default behavior,
  - opening only through Align,
  - explicit close/dismiss,
  - center-crosshair affordance and instruction copy,
  - repeated align entry without reset dependency,
  - removal of the mobile scroll-region contract and body/document scroll locking.
- Re-run the focused unit suites first, then broaden to the repo test script if the targeted pass stays green.

## Interface / State Contract
- `buildAlignmentTutorialModel(...)` should stop being “instructions list first” for the fast viewer path. The implementation should expose explicit fast-flow fields such as `nextAction` and `focusPrompt`, while retaining `notices` and `alignActionLabel`.
- `AlignmentInstructionsPanel` in `viewer-shell.tsx` should accept explicit close behavior and render a single next-action block instead of an ordered list.
- `ViewerShell` should separate:
  - warning visibility (`showAlignmentGuidance`, relative-sensor status),
  - fast alignment panel visibility,
  - mobile alignment focus mode.
- The settings sheet must not remain a second live-panel opener. If it retains an alignment affordance, it should delegate to the same single Align action contract instead of independently opening the fast-align panel.
- Scroll-lock state should be keyed from active AR camera-stage visibility or explicit alignment focus, not from the entire live route.

## Compatibility / Intentional Behavior Changes
- No route, permission, sensor-startup, or persisted settings schema changes are planned.
- Intentional UX change: the live alignment panel will no longer auto-open just because sensors need calibration or alignment health is poor; those conditions still surface via notices/banners and the user opens alignment explicitly.
- Intentional UX change: the mobile AR flow will no longer expose the current scrollable fullscreen overlay container.
- Intentional UX change: any separate settings-sheet alignment opener must be removed or collapsed into the same single Align action semantics so the fast alignment panel has one entry path.
- Reset calibration remains an optional utility, not a prerequisite for re-alignment.

## Regression Prevention
- Preserve manual panning, stage pointer capture, and existing `touch-none` stage behavior.
- Preserve calibration target selection/fallback resolution (`sun`/`moon` with planet/star/north fallback) and the existing quaternion calibration math.
- Preserve settings-sheet focus trapping and dialog behavior.
- Preserve scrollability for blocked/non-camera live screens while the AR stage itself is not active.
- Avoid unrelated layout or sensor-permission refactors; keep changes local to alignment state, viewer overlay layout, and tutorial copy contract.

## Validation
- Targeted unit tests:
  - `npm test -- tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx`
- Full unit suite after targeted coverage passes:
  - `npm test`
- Optional sanity check if layout wiring changes are broader than expected:
  - `npm run lint`

## Risk Register
- Scroll-lock cleanup could leak styles after unmount or route changes.
  - Control: store prior inline style values and restore them in effect cleanup; test mount/unmount behavior.
- Scroll-lock gating could be applied too early and hide blocked/recovery content on short screens.
  - Control: derive the lock from active camera-stage / explicit alignment-focus state only, and add tests that blocked or non-camera live states do not depend on the AR lock path.
- Replacing the scrollable overlay could accidentally block stage gestures.
  - Control: keep the stage full-screen and pointer-active, and constrain `pointer-events-auto` to explicit controls only.
- Sharing the tutorial model across viewer and settings sheet could cause accidental copy regressions outside the fast flow.
  - Control: keep the fast-flow contract explicit and local, or add fields instead of silently reusing the old list semantics.
- Leaving the settings sheet as a second opener would violate the requested visibility contract and create duplicated state entry logic.
  - Control: route any remaining settings-sheet affordance through the same single Align entry semantics and test for one opener contract.
- Center-tap apply wiring could interfere with ordinary marker taps or center-lock readouts.
  - Control: only enable the tappable center reticle during explicit alignment focus and verify marker interaction outside that mode.

## Rollback
- Revert the live alignment panel gating to the prior render condition if explicit-open state introduces a blocker, while retaining any isolated test-only improvements.
- Re-enable the prior overlay shell only if the non-scrolling replacement breaks viewer access on mobile; keep scroll-lock changes isolated so they can be reverted independently.
- Revert the fast-flow copy contract separately from calibration math if only the wording/panel rendering regresses.
