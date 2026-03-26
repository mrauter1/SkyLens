# Test Author ↔ Test Auditor Feedback

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: sensors-and-projection-foundation
- Phase Directory Key: sensors-and-projection-foundation
- Phase Title: Sensors and projection foundation
- Scope: phase-local authoritative verifier artifact

- Added coordinator coverage in [tests/unit/permission-coordinator.test.ts](/workspace/SkyLens/tests/unit/permission-coordinator.test.ts) to lock the new verified-live predicate across the three allowed active modes: full live, non-camera fallback, and manual-pan fallback, while preserving blocked partial/demo false cases. Updated [test_strategy.md](/workspace/SkyLens/.autoloop/tasks/implement-skylensprd-md-73e90f91/test/phases/sensors-and-projection-foundation/test_strategy.md) with the phase behavior-to-test map, invariants, edge cases, flake controls, and current gaps.

- `TST-001` `blocking` [tests/unit/permission-coordinator.test.ts](/workspace/SkyLens/tests/unit/permission-coordinator.test.ts), [tests/e2e/permissions.spec.ts](/workspace/SkyLens/tests/e2e/permissions.spec.ts): the new tests lock the `hasVerifiedLiveViewerState()` helper and the visible blocked/fallback UI states, but they still do not exercise [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) at the side-effect boundary. The exact regression that triggered `IMP-001` could reappear if the component stops using the helper and resumes calling `requestStartupObserverState()`, `requestRearCameraStream()`, or `subscribeToOrientationPose()` for blocked preflight states; all current tests would still pass because the helper would remain correct and the route-driven browser tests only assert rendered text. Minimal correction: add a component-level unit/integration test for `ViewerShell` (or a narrowly extracted render-layer seam) that mocks those three side-effect entry points and asserts they are not called for blocked partial live states, while remaining callable for verified non-camera/manual-pan live states where appropriate.

- `TST-001` `resolved` [tests/unit/viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts): the previously missing component-level side-effect coverage is now present. The test mounts `ViewerShell` under `jsdom`, mocks the location, camera, and orientation startup entry points, and proves the blocked preflight route suppresses all three while verified non-camera and manual-pan states still keep the appropriate live effects armed. This closes the material regression gap that remained after the coordinator-only coverage.

- Added AC-4 regression coverage in [tests/unit/location-foundation.test.ts](/workspace/SkyLens/tests/unit/location-foundation.test.ts) and [tests/unit/projection-camera.test.ts](/workspace/SkyLens/tests/unit/projection-camera.test.ts) for the locked startup geolocation options, watch-position options/cleanup, and exact-environment then environment rear-camera retry order. Updated [test_strategy.md](/workspace/SkyLens/.autoloop/tasks/implement-skylensprd-md-73e90f91/test/phases/sensors-and-projection-foundation/test_strategy.md) to reflect the current behavior map and remove the now-stale blocked-preflight component-gap note.

- Audit note: no new findings in run `run-20260326T020604Z-abe9114e`. The added location and camera tests materially improve AC-4 regression protection, stay deterministic through mocked runtime injection, and the criteria checkboxes remain accurate as fully satisfied.
