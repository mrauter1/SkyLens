# Implement ↔ Code Reviewer Feedback

- Task ID: desktop-ui-prd-ard-implementation
- Pair: implement
- Phase ID: desktop-quick-actions
- Phase Directory Key: desktop-quick-actions
- Phase Title: Simplify desktop quick actions and unify Enable AR
- Scope: phase-local authoritative verifier artifact

- IMP-001 `blocking` [SkyLensServerless/tests/unit/viewer-shell.test.ts, SkyLensServerless/tests/unit/viewer-shell-resolvers.test.ts]: The updated tests do not satisfy the phase deliverable for desktop permission-state routing. The desktop quick-row click path is only exercised for the motion-only state; camera-only and combined recovery remain covered only by resolver assertions or older non-row recovery tests, so AC-2 is not fully verified “behind the single desktop Enable AR action.” A regression in the desktop button wiring for camera-only or combined recovery would currently slip through. Minimal fix: add desktop-row unit coverage for camera-only and combined states (or a narrowly scoped shared desktop action helper test that explicitly exercises the row action mapping/end handler selection for all three recovery kinds).
- Review update (cycle 2): IMP-001 is resolved. `getPermissionRecoveryHandlerId` now centralizes the end-handler mapping used by the shared recovery click path, and resolver coverage now explicitly verifies camera-only, motion-only, combined, and ready-state routing alongside the existing desktop quick-row ordering/motion-path tests. No active findings remain for this phase.
