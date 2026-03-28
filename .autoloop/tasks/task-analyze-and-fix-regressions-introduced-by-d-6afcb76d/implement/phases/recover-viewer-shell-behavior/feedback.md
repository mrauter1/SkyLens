# Implement ↔ Code Reviewer Feedback

- Task ID: task-analyze-and-fix-regressions-introduced-by-d-6afcb76d
- Pair: implement
- Phase ID: recover-viewer-shell-behavior
- Phase Directory Key: recover-viewer-shell-behavior
- Phase Title: Recover Viewer Shell Behavior
- Scope: phase-local authoritative verifier artifact

## Findings

- IMP-001 | blocking | `components/viewer/viewer-shell.tsx` / `describeRuntimeExperience`: the authoritative permission-fallback browser contract is still broken for `camera=denied&orientation=granted` and `camera=granted&orientation=denied`. Running `npx playwright test tests/e2e/permissions.spec.ts` still fails in the browser-covered cases because the mobile overlay heading renders `Non-camera fallback` or `Manual pan fallback` instead of the preserved `Manual observer needed` heading expected by [`tests/e2e/permissions.spec.ts`](../../../../../../tests/e2e/permissions.spec.ts). The current unit coverage at `tests/unit/viewer-shell.test.ts` verifies startup side effects for those routes but does not assert the overlay heading/status combination, so the contract drift was missed. Minimal fix: restore the intended live fallback heading/content for those denied-permission mobile flows in `ViewerShell`, then add targeted unit assertions that cover the mobile overlay heading plus `Camera: Denied` / `Motion: Settling` and `Camera: Ready` / `Motion: Manual pan`.
