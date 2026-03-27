# Test Author ↔ Test Auditor Feedback

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: test
- Phase ID: motion-affordances-and-controls
- Phase Directory Key: motion-affordances-and-controls
- Phase Title: Add motion affordances and quality controls
- Scope: phase-local authoritative verifier artifact

- Added explicit AC-1 coverage for pre-upgrade settings payloads that omit `motionQuality`, pinning `balanced` defaulting without losing the rest of persisted settings.
- Confirmed the phase test slice passes with the current motion-affordance coverage set: settings controls/persistence, low-vs-balanced affordance rendering, reduced-motion suppression, stale satellite metadata, and additive stale ISS badge rendering.
- TST-001 [blocking] [tests/unit/viewer-shell-celestial.test.ts]: the motion-affordance tests never execute the `motionQuality='high'` render path. Today they prove `low` renders a vector and `balanced` renders a trail, but a regression that mapped `high` back to the low vector path, disabled affordances for `high`, or otherwise broke the high-quality policy would still pass. Minimal correction: add viewer-shell coverage that renders with `motionQuality='high'` and asserts the high path remains trail-based; if the implementation intends distinct high-vs-balanced history limits, pin that limit difference directly.
- Addressed TST-001 by adding explicit `motionQuality='high'` viewer-shell coverage in `tests/unit/viewer-shell-celestial.test.ts`; the phase slice now exercises low, balanced, and high affordance render modes and remains green at 73 passing tests.
- Re-audit cycle 2: TST-001 is resolved. No remaining blocking or non-blocking findings for this phase.
