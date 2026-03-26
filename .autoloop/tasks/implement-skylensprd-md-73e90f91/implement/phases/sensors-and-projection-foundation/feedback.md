# Implement ↔ Code Reviewer Feedback

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: sensors-and-projection-foundation
- Phase Directory Key: sensors-and-projection-foundation
- Phase Title: Sensors and projection foundation
- Scope: phase-local authoritative verifier artifact

- `IMP-001` `blocking` [components/viewer/viewer-shell.tsx:276](/workspace/SkyLens/components/viewer/viewer-shell.tsx#L276), [components/viewer/viewer-shell.tsx:322](/workspace/SkyLens/components/viewer/viewer-shell.tsx#L322), [components/viewer/viewer-shell.tsx:360](/workspace/SkyLens/components/viewer/viewer-shell.tsx#L360): the viewer now renders the preflight block for partial or otherwise invalid live route payloads, but the location, camera, and orientation effects still arm themselves whenever the URL says those permissions are `granted`. A direct URL such as `/view?entry=live&location=granted&camera=granted&orientation=unknown` will still call `getCurrentPosition()`, `getUserMedia()`, and subscribe to orientation events even though the shared contract and decisions ledger say `/view` must stay in preflight until a complete verified Start-flow payload exists. That creates unintended permission prompts/side effects from URL state alone and contradicts the previously locked “Start flow only” gate. Minimal fix: gate all live sensor/camera/orientation effects on the shared experience result (or one centralized `isVerifiedLiveState` predicate) rather than on individual raw route fields, so blocked preflight state is behavioral as well as visual.

- Resolution note: `IMP-001` is resolved. The implementation now centralizes verified-live gating in `hasVerifiedLiveViewerState()` within [lib/permissions/coordinator.ts](/workspace/SkyLens/lib/permissions/coordinator.ts) and reuses that predicate in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) for location, camera, and orientation effects, so blocked `/view` preflight states no longer arm browser APIs from URL fields alone. The added unit coverage in [tests/unit/permission-coordinator.test.ts](/workspace/SkyLens/tests/unit/permission-coordinator.test.ts) and the rerun validation (`npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`) support clearing the phase.

- Review note: no new findings in run `run-20260326T020604Z-abe9114e`. The producer turn was validation-only, the checked-in M2 sensor/projection implementation still matches the active phase contract and shared decisions, and the criteria checkboxes remain accurate as fully satisfied.
