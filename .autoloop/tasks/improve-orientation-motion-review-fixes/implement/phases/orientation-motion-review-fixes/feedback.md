# Implement ↔ Code Reviewer Feedback

- Task ID: improve-orientation-motion-review-fixes
- Pair: implement
- Phase ID: orientation-motion-review-fixes
- Phase Directory Key: orientation-motion-review-fixes
- Phase Title: Fix orientation safety and reset duplication
- Scope: phase-local authoritative verifier artifact

- IMP-001 [blocking] Validation gap: the producer notes show `tests/unit/viewer-shell.test.ts` still times out at 300 seconds instead of passing, so the requested "targeted tests plus any impacted suites" bar is not yet met for the directly touched viewer flow suite. The code changes in [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx) and [viewer-shell.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell.test.ts) look directionally correct, but this phase should not be marked complete until the impacted viewer suite either passes under a stable command or the validation scope is explicitly narrowed in authoritative clarifications.
- IMP-002 [non-blocking] Resolution check: the acceptance-aligned targeted validation command now passes in this verifier turn: `cd SkyLensServerless && timeout 120s npx vitest run tests/unit/orientation.test.ts tests/unit/viewer-shell.test.ts -t "(validates Safari compass-backed events before upgrading and downgrades after sustained failure|keeps motion-only retries pending until a usable sample arrives|clears stale live sensor state when switching into demo mode)"`. This resolves IMP-001 for the scoped phase contract, and I found no remaining blocking issues in the touched implementation.
