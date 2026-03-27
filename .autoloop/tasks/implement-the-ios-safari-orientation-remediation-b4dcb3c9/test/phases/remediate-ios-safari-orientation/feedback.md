# Test Author ↔ Test Auditor Feedback

- Task ID: implement-the-ios-safari-orientation-remediation-b4dcb3c9
- Pair: test
- Phase ID: remediate-ios-safari-orientation
- Phase Directory Key: remediate-ios-safari-orientation
- Phase Title: Remediate the iOS Safari orientation pipeline
- Scope: phase-local authoritative verifier artifact

- Added direct history-sensitivity regressions in `tests/unit/orientation-foundation.test.ts` for both zenith (`gamma: 89`) and nadir (`gamma: -89`) landscape quaternions so identical `±90°` samples normalize the same with and without prior portrait-history samples.
- Kept the existing subscription regression in `tests/unit/orientation-permission-and-subscription.test.ts` as the smoothed-stream guard for repeated near-zenith landscape samples staying on the same positive pitch branch.
- Validation performed: `npx vitest run tests/unit/orientation-foundation.test.ts tests/unit/orientation-permission-and-subscription.test.ts` (`24` tests passed).

- Audit pass (2026-03-26): no findings. The current unit coverage matches the shared decisions by locking projection/alignment invariants, Safari heading precedence, >90° continuity, recenter stability, and both positive and negative `±90°` landscape history-sensitivity branches, while keeping the manual iPhone Safari smoke-validation gap explicit rather than silently normalizing it into unit expectations.
