# Implementation Notes

- Task ID: implement-alignment-ui-requirements-md-keep-alig-0a608ab4
- Pair: implement
- Phase ID: alignment-ui-updates
- Phase Directory Key: alignment-ui-updates
- Phase Title: Alignment UI updates
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-settings.test.tsx`

## Symbols touched
- `ViewerShell`
- `resolveCalibrationTarget`
- `createCalibrationTarget`
- `describeCalibrationStatus`
- `buildCalibrationInstructions`
- `AlignmentInstructionsPanel`
- `SettingsSheet`
- `AlignmentTargetButton`
- `AlignmentTargetIcon`

## Checklist mapping
- Plan 1: removed the post-success visibility gate from the live mobile `Align` action.
- Plan 2: added explicit step-by-step alignment instructions in viewer-shell live UI surfaces and the settings calibration panel.
- Plan 3: added session-scoped Sun/Moon target preference, resolver fallback messaging, and focused unit coverage updates.

## Assumptions
- Session-only Sun/Moon preference is sufficient; no persistence or viewer-settings schema changes were added.
- Existing fallback priority remains authoritative when the preferred body is unavailable.

## Preserved invariants
- Calibration math, pose creation, and fallback target ordering remain unchanged aside from preferring the selected Sun/Moon when available.
- Reset still restores identity calibration and fine-adjust still operates on the existing calibration quaternion path.
- Manual mode continues to block live sensor alignment actions.

## Intended behavior changes
- Live mobile `Align` stays visible after successful calibration and can re-enter explicit alignment focus.
- Calibration-relevant live UI now shows an on-screen instruction card with ordered steps and Sun/Moon selection buttons.
- Settings calibration panel now exposes the same target toggle, fallback explanation, and step list.
- Post-alignment status copy now prefers the target actually used during alignment when that is known in-session.

## Known non-changes
- No astronomy calculation, projection, or pose-calibration math changes.
- No local-storage persistence for target preference.
- No broader settings-sheet layout redesign outside the calibration section.

## Expected side effects
- When Sun or Moon is unavailable, the corresponding toggle is disabled and the UI explains which fallback target will be used.
- On-screen alignment instructions are shown only during live calibration-relevant states to avoid permanent overlay clutter.

## Validation performed
- Reviewed focused diffs across viewer-shell, settings-sheet, and scoped unit tests.
- Attempted `pnpm test -- tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx`, but the workspace has no installed `node_modules` and the `vitest` binary is unavailable.
- Attempted `pnpm exec tsc --noEmit`, but dependency types are unavailable for the same reason; the command failed repo-wide on missing installed packages rather than scoped code syntax.

## Deduplication / centralization
- Centralized preferred-target resolution in `resolveCalibrationTarget`.
- Centralized instructional step copy generation in `buildCalibrationInstructions` and passed that copy into the settings sheet instead of duplicating viewer-shell state logic there.
