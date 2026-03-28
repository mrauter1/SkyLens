# Implementation Notes

- Task ID: fix-settings-scroll-lock-and-motion-retry-review
- Pair: implement
- Phase ID: fix-scroll-lock-and-permission-recovery
- Phase Directory Key: fix-scroll-lock-and-permission-recovery
- Phase Title: Coordinate settings scroll locking and restore combined motion retry feedback
- Scope: phase-local producer artifact
- Files changed: `components/settings/settings-sheet.tsx`; `components/viewer/viewer-shell.tsx`; `tests/unit/settings-sheet.test.tsx`; `tests/unit/viewer-shell.test.ts`; `.autoloop/tasks/fix-settings-scroll-lock-and-motion-retry-review/decisions.txt`
- Symbols touched: `SettingsSheet`; `ViewerShell`; `handleRetryPermissions`; `handleRetryMotionPermission`; `applyOrientationRetryResult`; `shouldLockViewerScroll`
- Checklist mapping:
  1. Coordinate settings-open state with viewer-level scroll locking: completed via per-instance `onOpenChange` wiring and `ViewerShell` aggregation.
  2. Preserve motion retry denial handling in the combined recovery path: completed via shared orientation retry result handling in `ViewerShell`.
  3. Validate with targeted tests: completed in `tests/unit/viewer-shell.test.ts` and `tests/unit/settings-sheet.test.tsx`.
- Assumptions: `SettingsSheet` can unmount while open from the mobile overlay path, so the parent open-state callback must clear on unmount.
- Preserved invariants: combined recovery still requests orientation, then camera, then observer; camera-only recovery still avoids orientation and observer retry work; settings copy and local focus/dialog behavior remain unchanged.
- Intended behavior changes: `SettingsSheet` no longer mutates document/body overflow styles; `ViewerShell` now owns document/body scroll locking for viewer-stage and settings visibility; combined camera+motion recovery restores `motionRetryError` for denied or unavailable orientation retries.
- Known non-changes: no route-shape changes; no persisted settings-shape changes; no consolidation of the two mounted `SettingsSheet` instances; no copy changes.
- Expected side effects: background scroll now locks in non-live states while a settings sheet is open; mobile settings unmount clears the parent lock flag.
- Validation performed:
  `npm ci`
  `npm test -- --run tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx`
- Deduplication / centralization: motion denial messaging and route/startup sync for orientation retries now flow through `applyOrientationRetryResult`; document/body overflow ownership is centralized in `ViewerShell`.
