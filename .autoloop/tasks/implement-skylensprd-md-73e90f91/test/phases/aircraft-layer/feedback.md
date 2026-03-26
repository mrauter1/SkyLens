# Test Author ↔ Test Auditor Feedback

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: aircraft-layer
- Phase Directory Key: aircraft-layer
- Phase Title: Aircraft layer
- Scope: phase-local authoritative verifier artifact

- Added aircraft-layer unit coverage for the remaining credential-present fallback branch: authenticated OpenSky failure now has an explicit regression test proving the code falls back to anonymous latest-state access instead of degrading immediately. Updated `test_strategy.md` with the full AC-to-test map, preserved invariants, failure paths, and current known gap.
- TST-001 | non-blocking | [tests/unit/aircraft-layer.test.ts](/workspace/SkyLens/tests/unit/aircraft-layer.test.ts#L204): the suite now covers authenticated success, authenticated state-fetch failure, and one-time `401` refresh, which is enough for phase completion. One remaining unpinned credential-present branch is token-endpoint failure before any authenticated state request. A small stubbed test for token POST failure followed by anonymous success would close that last fallback permutation if the team wants full branch exhaustiveness later.
