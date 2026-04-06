# Test Author ↔ Test Auditor Feedback

- Task ID: skylensserverless-scope-optics
- Pair: test
- Phase ID: scope-optics-foundation
- Phase Directory Key: scope-optics-foundation
- Phase Title: Settings and Optics Foundation
- Scope: phase-local authoritative verifier artifact

- Added focused scope-optics coverage for formula determinism/monotonicity, mocked star-pipeline ordering/filtering, real-fixture daylight non-regression, persisted scope-settings round-trip, and viewer-shell forwarding of persisted scope settings into `normalizeVisibleStars`.
- Added explicit off-state assertions proving that `scopeRender` metadata is absent when `scopeModeEnabled` is false in both the mocked star pipeline and the bundled-catalog regression coverage.
- TST-001 | blocking | [tests/unit/stars-scope-pipeline.test.ts] and [tests/unit/celestial-layer.test.ts] never assert the off-state contract that `metadata.scopeRender` must be absent when `scopeModeEnabled` is `false`. That is a material regression surface because a future refactor could attach render metadata unconditionally, silently changing the legacy non-scope star path while all current tests still pass. Minimal correction: add an explicit no-scope assertion that stars normalized with `scopeModeEnabled: false` do not carry `scopeRender`, ideally in the mocked pipeline test and/or the real-fixture celestial regression test.
- TST-002 | non-blocking | Re-audit: `TST-001` is resolved. The suite now asserts the off-state `scopeRender` absence invariant in both `tests/unit/stars-scope-pipeline.test.ts` and `tests/unit/celestial-layer.test.ts`, and the focused validation slice passes with no remaining blocking audit findings.
