# Test Strategy

- Task ID: fix-settings-scroll-lock-and-motion-retry-review
- Pair: test
- Phase ID: fix-scroll-lock-and-permission-recovery
- Phase Directory Key: fix-scroll-lock-and-permission-recovery
- Phase Title: Coordinate settings scroll locking and restore combined motion retry feedback
- Scope: phase-local producer artifact
- Behavior-to-test coverage map:
  - AC-1 scroll-lock ownership:
    `tests/unit/settings-sheet.test.tsx`
    Verifies the sheet keeps its fixed shell and internal scroll region without mutating document/body overflow, and reports `onOpenChange` transitions.
  - AC-2 coordinated locking and overlap:
    `tests/unit/viewer-shell.test.ts`
    Verifies `ViewerShell` locks/unlocks document scroll from settings visibility in demo mode and stays locked while settings opens/closes over an already-active live camera stage.
  - AC-3 combined recovery motion denial:
    `tests/unit/viewer-shell.test.ts`
    Verifies the combined camera+motion CTA still retries camera, updates the route, and surfaces the existing motion-denial alert when orientation remains denied.
  - Mobile unmount cleanup edge case:
    `tests/unit/settings-sheet.test.tsx`
    Verifies `onOpenChange(false)` fires when `SettingsSheet` unmounts while open so the mobile overlay path cannot leave the parent lock flag stuck.
- Preserved invariants checked:
  - Camera-only recovery remains scoped to camera and does not add orientation or observer retry work.
  - Motion-only recovery still updates the route and keeps recovery UI visible on denial.
  - Existing dialog layout, focus trapping, and close behavior in `SettingsSheet` remain intact.
- Failure-path coverage:
  - Motion permission denied in motion-only recovery.
  - Motion permission denied in combined camera+motion recovery.
  - Settings sheet unmount while open.
- Flake controls:
  - Use direct prop-callback invocation in the mocked `SettingsSheet` viewer tests to avoid DOM/CSS timing sensitivity between desktop and mobile mounts.
  - Keep assertions local to document/body overflow styles, route replacements, and rendered copy; no network or timer dependence beyond existing `flushEffects()` usage.
- Known gaps:
  - No end-to-end coverage for actual mobile overlay unmount plus real `SettingsSheet` DOM interaction in the same test; unit coverage splits child callback cleanup and parent lock aggregation deterministically.
