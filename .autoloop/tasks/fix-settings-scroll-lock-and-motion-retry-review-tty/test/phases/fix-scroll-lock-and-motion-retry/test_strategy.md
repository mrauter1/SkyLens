# Test Strategy

- Task ID: fix-settings-scroll-lock-and-motion-retry-review-tty
- Pair: test
- Phase ID: fix-scroll-lock-and-motion-retry
- Phase Directory Key: fix-scroll-lock-and-motion-retry
- Phase Title: Coordinate viewer lock ownership and restore combined motion retry messaging
- Scope: phase-local producer artifact

## Behavior to test coverage map
- AC-1 viewer-owned scroll lock:
  - `tests/unit/viewer-shell.test.ts`: verifies settings open alone locks document/body scroll and unlocks on close.
  - `tests/unit/viewer-shell.test.ts`: verifies scroll lock stays active when settings remains open after the live camera lock clears.
  - `tests/unit/settings-sheet.test.tsx`: verifies the sheet still renders as a fixed shell with an internal scroll region and does not mutate global overflow styles directly.
- AC-2 combined recovery motion messaging:
  - `tests/unit/viewer-shell.test.ts`: verifies combined camera+motion retry keeps camera recovery active and preserves the motion denial alert text when orientation retry returns `denied`.
  - `tests/unit/viewer-shell.test.ts`: verifies combined retry still surfaces `motionRetryError` when the orientation retry throws while camera recovery continues.
- Sheet open-state reporting:
  - `tests/unit/settings-sheet.test.tsx`: verifies `onOpenChange(true)` on open, `onOpenChange(false)` on close, and `onOpenChange(false)` on unmount while open.

## Preserved invariants checked
- `ViewerShell` remains the sole owner of document/body scroll-lock side effects.
- Combined recovery does not regress camera retry sequencing or route-state synchronization.
- Motion denial copy remains unchanged.

## Edge cases and failure paths
- Settings lock remains active across overlapping viewer-lock transitions.
- Combined retry handles both `denied` and thrown orientation retry outcomes.
- Settings-only tests explicitly clear leaked document/body overflow styles before and after each case.

## Stabilization approach
- All tests use mocked permission/camera services and React `act()` flushing to keep async transitions deterministic.
- Settings-sheet tests reset document/body style state in setup/teardown to prevent cross-test contamination.

## Known gaps
- No browser-level integration test exercises real desktop/mobile breakpoint rendering for both settings-sheet instances simultaneously; current coverage remains unit-level and callback-driven.
