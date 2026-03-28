# Implementation Notes

- Task ID: fix-settings-scroll-lock-and-motion-retry-review-tty
- Pair: implement
- Phase ID: fix-scroll-lock-and-motion-retry
- Phase Directory Key: fix-scroll-lock-and-motion-retry
- Phase Title: Coordinate viewer lock ownership and restore combined motion retry messaging
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `.autoloop/tasks/fix-settings-scroll-lock-and-motion-retry-review-tty/decisions.txt`

## Symbols touched
- `ViewerShell`
- `requestOrientationRetry`
- `handleRetryPermissions`
- `handleRetryMotionPermission`

## Checklist mapping
- Milestone 1: verified existing viewer-owned settings lock wiring and strengthened regression coverage for settings-open lock ownership.
- Milestone 2: updated combined permission recovery to preserve motion retry errors when orientation permission retry throws while keeping camera recovery active.
- Milestone 3: tightened focused unit coverage for settings lock ownership and combined recovery retry behavior.

## Assumptions
- Current `ViewerShell` settings-open state lift (`isDesktopSettingsSheetOpen` / `isMobileSettingsSheetOpen`) is the intended scroll-lock owner and did not need structural changes.

## Preserved invariants
- `ViewerShell` remains the only component responsible for document/body scroll-lock styles.
- Camera retry still runs before route/startup reconciliation in the combined recovery flow.
- Existing motion denial copy is unchanged.

## Intended behavior changes
- Combined camera+motion recovery no longer falls back to the generic startup error when the motion permission retry throws; it continues camera/location recovery and surfaces `motionRetryError`.

## Known non-changes
- No UX copy changes.
- No route shape, persisted settings schema, or settings sheet layout changes.
- `components/settings/settings-sheet.tsx` was analyzed but did not require code changes in this turn.

## Expected side effects
- Combined recovery can now leave camera recovery successful while keeping the prior denied/unknown orientation route state and showing the motion retry alert.
- Settings-sheet tests no longer rely on leaked global overflow styles from other suites.

## Validation performed
- `pnpm vitest tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx`

## Deduplication / centralization notes
- Reused a single `requestOrientationRetry` helper for motion permission exception handling across the motion-only and combined recovery paths.
