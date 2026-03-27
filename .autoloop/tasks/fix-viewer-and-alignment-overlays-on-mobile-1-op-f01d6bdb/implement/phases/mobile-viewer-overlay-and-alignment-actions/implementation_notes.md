# Implementation Notes

- Task ID: fix-viewer-and-alignment-overlays-on-mobile-1-op-f01d6bdb
- Pair: implement
- Phase ID: mobile-viewer-overlay-and-alignment-actions
- Phase Directory Key: mobile-viewer-overlay-and-alignment-actions
- Phase Title: Fix mobile viewer overlay scrolling and first-use alignment actions
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `tests/unit/viewer-shell.test.ts`
- `.autoloop/tasks/fix-viewer-and-alignment-overlays-on-mobile-1-op-f01d6bdb/decisions.txt`

## Symbols touched
- `ViewerShell`
- `enterMobileAlignmentFocus`
- `alignCalibrationTarget`
- `isMobileAlignmentFocusActive`
- `canAlignCalibration`
- `settingsSheetProps`

## Checklist mapping
- Plan 1: moved mobile overlay scrolling to the full-screen safe-area wrapper and updated the mobile overlay test contract.
- Plan 2: added `isMobileAlignmentFocusActive` so explicit mobile alignment hides overlay chrome and leaves only the mobile align action.
- Plan 3: kept the closed mobile quick-action row state-aware and corrected the first-use `Align` CTA so it enters mobile alignment focus before the in-focus align button can perform calibration.
- Validation: extended `tests/unit/viewer-shell.test.ts` for first-use mobile actions, alignment focus entry, and the safe-area scroll-region contract.

## Assumptions
- “Keep the align button visible” allows the closed mobile footer `Align` CTA to remain visible but disabled until calibration is actionable, while the in-focus `Align` button performs the actual calibration step.

## Preserved invariants
- Desktop header/content composition remains unchanged.
- Existing permission handlers and startup ordering are reused; no permission-coordinator or storage-schema logic changed.
- `SettingsSheet` remains the calibration/settings entry point and still receives the existing action callbacks.

## Intended behavior changes
- Opened mobile overlay content now scrolls inside a safe-area-aware full-screen wrapper instead of an inner capped sheet.
- Explicit alignment flows on mobile close/hide nonessential overlay chrome and keep only the bottom align action visible.
- Closed mobile quick actions can now surface permission enablement and first-use align affordances without opening the overlay.
- The closed mobile first-use `Align` CTA stays visible-but-disabled until calibration is actionable; once enabled, it enters mobile alignment focus first, and the in-focus `Align` button remains the only control that performs calibration.

## Known non-changes
- Desktop layout and settings-sheet behavior are not redesigned.
- Permission request order and observer startup logic are unchanged.
- No persisted settings fields or routes were added or removed.

## Expected side effects
- Mobile live states with missing motion or camera access now expose an amber permission button in the closed footer.
- Mobile live states with incomplete calibration now show an align action outside the overlay.

## Validation performed
- `git diff --check`
- Attempted `pnpm test -- --run tests/unit/viewer-shell.test.ts`
- The targeted test command failed in this workspace because `vitest` is unavailable and `node_modules` is not installed.
- Static review of the updated footer `Align` CTA wiring and the regression tests that now separate the visible-but-disabled pre-sample state from the focus-first actionable path.

## Deduplication / centralization
- Reused existing `handleRetryPermissions`, `handleRetryMotionPermission`, and calibration callbacks instead of adding parallel mobile-only startup or calibration flows.
