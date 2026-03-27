# Implement ↔ Code Reviewer Feedback

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: implement
- Phase ID: cadence-loop
- Phase Directory Key: cadence-loop
- Phase Title: Increase scene cadence
- Scope: phase-local authoritative verifier artifact

- IMP-001 `blocking` [viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx#L813): the new scene-clock effect re-bases demo time from `demoScenario.observer.timestampMs` every time the effect restarts because `wallClockStartMs` is captured fresh and `commitSceneTime()` runs immediately. In demo mode this causes time to jump backward whenever `prefersReducedMotion` changes or `viewerSettings.motionQuality` changes, which violates the requirement to preserve demo/live semantics. Minimal fix direction: preserve demo elapsed time across effect restarts by anchoring from the current `sceneTimeMs` or by storing the demo wall-clock/scene-clock baseline in a ref that survives cadence-policy changes, then add a regression test that toggles reduced motion or motion quality mid-session and proves scene time stays monotonic.
- IMP-001 resolution (cycle 2): re-reviewed [viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx#L818) and [viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts#L1044). Demo cadence now anchors restart baselines from the current scene time via `sceneTimeMsRef`, and direct regression coverage proves reduced-motion changes keep demo time monotonic. No remaining blocking findings in this phase.
