# Test Author ↔ Test Auditor Feedback

- Task ID: implement-skylensprd-md-73e90f91
- Pair: test
- Phase ID: demo-polish-and-verification
- Phase Directory Key: demo-polish-and-verification
- Phase Title: Demo mode, polish, and verification
- Scope: phase-local authoritative verifier artifact

- Cycle 2 producer update: added deterministic regression coverage for manual-mode double-tap recenter, reduced-motion label chrome, and real `/api/health` cache-status surfacing through the settings sheet. Validation passed with `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e`.

- TST-001 [blocking] Reduced-motion behavior is implemented in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) through `matchMedia('(prefers-reduced-motion: reduce)')`, trail suppression, and transition-class removal, but the current phase tests never stub `matchMedia` or assert the reduced-motion path. A regression that keeps rendering motion trails or animated transitions for reduced-motion users would still pass the suite. Minimal correction: add a viewer-shell test that forces reduced motion on and asserts the trail polyline is absent while the demo/manual viewer remains usable.

- TST-002 [blocking] Manual-mode double-tap recenter is a phase requirement and has dedicated logic in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx), but the tests only cover keyboard panning and the label-tap pointer fix. There is no deterministic assertion that two taps within the 280 ms window reset the manual pose, or that a single tap does not. A broken or over-eager recenter path would not be caught. Minimal correction: add a unit test around the stage pointer handlers using mocked time or fake timers to verify both the positive double-tap case and the single-tap non-recenter case.

- TST-003 [blocking] `/api/health` is unit-tested in isolation and the settings sheet can render arbitrary availability labels, but there is no integration test proving [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) actually fetches `/api/health` and surfaces stale/expired satellite cache state through the settings UI. That leaves the acceptance-criterion status-surfacing path unprotected: the fetch wiring, schema parse, or `getSatelliteLayerStatusLabel` mapping could break without any failing test. Minimal correction: add a viewer-shell test that stubs `fetch('/api/health')`, opens Settings, and asserts the real stale/expired cache labels appear.

- Cycle 2 auditor review: TST-002 and TST-003 are now resolved by deterministic coverage in [viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts) and [viewer-settings.test.tsx](/workspace/SkyLens/tests/unit/viewer-settings.test.tsx). The remaining material gap is the trail-specific part of TST-001.

- TST-001 [blocking] Update: the new reduced-motion checks in [viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts) now stub `matchMedia`, but they only assert label transition classes. The phase-required object-trail behavior in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) is still untested: no test proves that an eligible aircraft/ISS trail polyline appears as scene time advances, and no test proves that the same polyline is suppressed when reduced motion is enabled. A regression that disables trails entirely or keeps drawing them for reduced-motion users would still pass. Minimal correction: add a viewer-shell regression that advances scene time for a trail-eligible object and asserts trail presence in the default branch plus trail absence in the reduced-motion branch.

- Cycle 3 producer update: added trail-specific viewer-shell coverage in [viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts) by capturing the scene-time interval, asserting an ISS trail `polyline` appears in the default branch, and asserting the same trail stays absent when reduced motion is enabled. Validation passed again with `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e`.

- Cycle 3 auditor review: TST-001 is now resolved by the new ISS trail `polyline` assertions in [viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts). TST-002 and TST-003 remain resolved from the prior cycle. No new blocking or non-blocking findings.
