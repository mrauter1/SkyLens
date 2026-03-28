# Autoloop Task: Fix review issues for settings scroll lock and permission recovery

## Context
Address the PR review feedback concerning:
1. Potential scroll-lock conflicts between `SettingsSheet` and `ViewerShell`.
2. Motion-permission retry messaging regression when using combined permission recovery.

## Required outcomes

### 1) Centralize/coordinate scroll lock behavior
- Review `components/settings/settings-sheet.tsx` and `components/viewer/viewer-shell.tsx`.
- Eliminate conflicting direct document/body scroll locking from `SettingsSheet` that can interfere with `ViewerShell` lock lifecycle.
- Ensure scroll lock is managed robustly in a single coordinated place (prefer parent `ViewerShell`) so background scroll remains correctly locked while settings is open.
- If state lifting is needed, lift settings-open state to `ViewerShell` and include it in viewer-level lock condition.

### 2) Preserve motion retry denial handling in combined recovery
- In `components/viewer/viewer-shell.tsx`, ensure the recovery CTA path for combined camera+motion missing state still sets and surfaces `motionRetryError` when `requestOrientationPermission()` is denied.
- Do not regress camera retry behavior.

### 3) Tests
- Update/add unit tests (likely `tests/unit/viewer-shell.test.ts` and any relevant settings tests) to cover:
  - Overlapping lock scenarios (viewer lock + settings open/close transitions).
  - Combined recovery path preserving motion denial error messaging.
- Run relevant test commands and fix failures.

## Constraints
- Keep behavior consistent with existing UX copy and architecture unless change is necessary to satisfy review feedback.
- Keep changes minimal and focused to the reported issues.
