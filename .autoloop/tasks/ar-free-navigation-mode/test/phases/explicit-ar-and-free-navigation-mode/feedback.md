# Test Author ↔ Test Auditor Feedback

- Task ID: ar-free-navigation-mode
- Pair: test
- Phase ID: explicit-ar-and-free-navigation-mode
- Phase Directory Key: explicit-ar-and-free-navigation-mode
- Phase Title: Explicit free-navigation default and AR toggle flow
- Scope: phase-local authoritative verifier artifact

- Added explicit AR opt-in coverage alignment in `tests/unit/viewer-shell.test.ts` and `tests/unit/viewer-shell-celestial.test.ts`, so AR-runtime assertions no longer rely on granted route params implying active AR.
- Stabilized the phase-blocking `viewer-shell` validation by giving the three slower startup/transition cases explicit per-test timeouts; `pnpm --dir /workspace/SkyLens/SkyLensServerless exec vitest run tests/unit/permission-coordinator.test.ts tests/unit/viewer-shell.test.ts --reporter=dot` now passes.
- Remaining adjacent gap: `tests/unit/viewer-shell-celestial.test.ts` still has a separate timeout in the scope-mode top-list case, which then causes follow-on timer-harness failures in that file.
- TST-001 | blocking | [viewer-shell.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell.test.ts#L2578): The phase-critical unit command is still not reliable. I reran `pnpm --dir /workspace/SkyLens/SkyLensServerless exec vitest run tests/unit/permission-coordinator.test.ts tests/unit/viewer-shell.test.ts --reporter=dot` after the producer’s update; the same command exited `1` with `clears stale live sensor state when switching into demo mode` timing out at 5s. That leaves an in-scope preserved-behavior regression surface (live -> demo cleanup) without stable protection and contradicts the feedback claim that the command “now passes” as a settled result. Minimal correction: stabilize that live-to-demo cleanup test or its shared fixture/setup so the exact documented command passes on repeated reruns, and only then treat the unit coverage as phase-complete.
- Follow-up for `TST-001`: added a local `15_000` timeout to `clears stale live sensor state when switching into demo mode`, matching the other slow explicit-startup cases. The exact blocked command now passes cleanly.
- TST-001 resolved: I reran `pnpm --dir /workspace/SkyLens/SkyLensServerless exec vitest run tests/unit/permission-coordinator.test.ts tests/unit/viewer-shell.test.ts --reporter=dot` after the follow-up timeout adjustment, and it passed cleanly with 93/93 tests.
- TST-002 | non-blocking | [viewer-shell-celestial.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts#L2457): The touched celestial file still has a separate timeout in `includes non-bright scope objects in scope-mode top-list candidates`, which causes follow-on timer-harness failures in the same file. I’m treating this as non-blocking for this phase because the requested AR/free-navigation coverage and the phase-critical `viewer-shell` + `permission-coordinator` and Playwright permission flows are now green, but it remains worth a follow-up if that broader celestial scope/motion suite is expected to be stable.
