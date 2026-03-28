# Mobile Alignment Overlay Plan

## Scope
- Finalize the live mobile alignment flow so the alignment options/instructions UI does not remain over the center crosshair tap target.
- Keep scope local to `components/viewer/viewer-shell.tsx` and `tests/unit/viewer-shell.test.ts`.
- Preserve the existing route/query contract, persisted viewer settings, calibration math, desktop layout, and non-camera/manual/demo behavior.

## Findings
- `ViewerShell` already tracks three separate booleans for the relevant UI surfaces: `isMobileOverlayOpen`, `isAlignmentPanelOpen`, and `isMobileAlignmentFocusActive`.
- The current gap is the transition contract: `openAlignmentExperience()` opens the alignment panel and activates mobile focus mode at the same time for the live camera path.
- Mobile quick actions render `AlignmentInstructionsPanel` whenever `isAlignmentPanelOpen` is true, so focus mode can coexist with the instructions/options panel and block the center tap target.
- Existing close and calibration-complete handlers already restore normal actions cleanly, so the safest fix is to keep the current state model and introduce an explicit start-focus step instead of adding new architecture.

## Milestone
### 1. Decouple mobile alignment options from active crosshair focus
- Change `openAlignmentExperience()` so the mobile Align quick action opens the alignment instructions/options panel first instead of immediately entering crosshair tap mode.
- Add a dedicated `Start alignment` callback from `AlignmentInstructionsPanel` that closes or hides the panel and enables `isMobileAlignmentFocusActive` for the live camera mobile path.
- Keep a visible `Start alignment` control on the mobile align view whenever the panel is open; when calibration cannot run yet, leave the control visible but disabled and pair it with the existing explanatory guidance instead of withholding the action entirely.
- Keep `closeAlignmentExperience()` as the cancel path: clear panel visibility, disable focus mode, and restore normal quick actions without mutating calibration.
- Keep `alignCalibrationTarget()` as the completion path: apply calibration, clear focus mode, leave the panel closed, and return the mobile quick actions/overlay trigger.
- Update render guards so the alignment panel never renders during active mobile focus mode and the center crosshair button remains the only active center tap target.

## Interface And Compatibility Notes
- State invariants:
  - `isAlignmentPanelOpen` controls visibility of the alignment instructions/options UI only.
  - `isMobileAlignmentFocusActive` controls center-crosshair tap mode only.
  - Active mobile focus implies the mobile overlay is closed and the alignment panel is hidden.
- Component/interface changes:
  - `AlignmentInstructionsPanel` should gain an explicit `onStartAlignment` callback and a small opt-in flag for showing the CTA where this mobile flow needs it.
  - When the CTA is shown for this mobile flow, it should remain visible even if `canAlignCalibration` is false; in that state the button should be disabled rather than omitted so the align view always exposes the requested start action.
  - Existing `onClose`, target selection, reset calibration, and fine-adjust callbacks stay intact.
- Compatibility:
  - No route, storage, sensor, or calibration-contract changes are needed.
  - Desktop and non-mobile alignment behavior should stay semantically unchanged unless the shared panel CTA is intentionally reused without changing their current flow.

## Validation
- Extend the mobile alignment coverage in `tests/unit/viewer-shell.test.ts` to assert:
  - opening alignment from the mobile quick action shows the options/instructions panel with a clear `Start alignment` action before focus mode begins
  - the `Start alignment` action stays visible but disabled when live orientation data is not yet available, while the existing blocker guidance remains present
  - activating `Start alignment` hides the panel and leaves the crosshair action visible and clickable
  - closing/canceling from the panel restores normal quick actions without applying calibration
  - tapping the center crosshair applies calibration and exits focus mode with normal quick actions restored
- Preserve existing regression coverage for repeated alignment, fine-adjust/reset actions, and the pre-live-sample guidance path.
- Implementation/test phases should run focused viewer-shell tests first, then the repo-required validation commands for tests, lint, and type checking requested by the task.

## Regression Prevention
- Preserve these invariants:
  - the mobile overlay and alignment panel never cover the center tap target during active focus mode
  - calibration is applied only from the center crosshair action, not from opening or closing the alignment panel
  - `canAlignCalibration` gating still prevents unavailable live-sensor paths from forcing focus mode while leaving the `Start alignment` action visible and disabled on the panel
  - repeated alignment remains possible without requiring a reset first
- Prefer local handler/render updates inside `ViewerShell` over new helpers or shared state abstractions.

## Risk Register
- R1: Adding a shared panel CTA could accidentally change desktop alignment UX.
  - Control: make the CTA opt-in for the mobile/live alignment panel path or otherwise preserve desktop semantics explicitly.
- R2: Render-guard changes could hide the panel without restoring the user’s route back to normal actions.
  - Control: keep `closeAlignmentExperience()` as the explicit cancel path and verify focus completion/cancel restores the existing quick-action row.
- R3: Tests could miss the original bug if they assert only crosshair presence.
  - Control: add explicit assertions that `alignment-instructions-panel` is absent during focus mode and that `alignment-crosshair-button` remains interactable.
- R4: The no-live-sample path could regress by entering focus too early.
  - Control: preserve the existing guidance path until calibration can actually run, but keep `Start alignment` visible and disabled with explanatory copy instead of withholding it.

## Rollback
- Revert the mobile alignment transition/render changes in `components/viewer/viewer-shell.tsx` if focus entry, cancel, or completion semantics regress.
- Revert only the focused test updates if implementation direction changes while preserving the surrounding alignment behavior.
