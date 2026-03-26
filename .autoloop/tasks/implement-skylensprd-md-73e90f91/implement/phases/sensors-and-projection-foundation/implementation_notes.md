# Implementation Notes

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: sensors-and-projection-foundation
- Phase Directory Key: sensors-and-projection-foundation
- Phase Title: Sensors and projection foundation
- Scope: phase-local producer artifact

## Files changed

- `lib/sensors/orientation.ts`
- `lib/sensors/location.ts`
- `lib/projection/camera.ts`
- `lib/permissions/coordinator.ts`
- `components/viewer/viewer-shell.tsx`
- `tests/unit/permission-coordinator.test.ts`
- `tests/unit/orientation-foundation.test.ts`
- `tests/unit/location-foundation.test.ts`
- `tests/unit/projection-camera.test.ts`
- `tests/e2e/permissions.spec.ts`
- `eslint.config.mjs`

## Symbols touched

- `requestOrientationPermission`
- `normalizeDeviceOrientationReading`
- `smoothOrientationSample`
- `computeAlignmentHealth`
- `createSensorCameraPose`
- `createManualPoseState`
- `applyManualPoseDrag`
- `createManualCameraPose`
- `subscribeToOrientationPose`
- `requestStartupObserverState`
- `startObserverTracking`
- `shouldAcceptObserverUpdate`
- `hasVerifiedLiveViewerState`
- `getRearCameraConstraintCandidates`
- `requestRearCameraStream`
- `getEffectiveVerticalFovDeg`
- `createCameraQuaternion`
- `projectWorldPointToScreen`
- `pickCenterLockedCandidate`
- `ViewerShell`

## Checklist mapping

- M2 normalized observer and pose contracts: complete
- M2 rear-camera acquisition with exact-environment then environment fallback and no microphone: complete
- M2 startup high-accuracy location plus 25m/15s watch gating: complete
- M2 fixed-FOV math, quaternion transforms, world-to-screen projection, and 4° center-lock: complete
- M2 reticle, dummy overlay harness, and manual-pan fallback: complete
- M2 unit coverage for projection and sensor math plus browser regression coverage for viewer states: complete

## Assumptions

- The phase session file referenced in the run preamble was missing on disk; implementation proceeded from the immutable request, plan, criteria, feedback, and decisions artifacts.
- Browser E2E validation in this environment required Playwright browser binaries and Linux runtime dependencies to be installed locally before `npm run test:e2e` could execute.

## Preserved invariants

- Orientation smoothing and alignment-health scoring keep the PRD 2-second window, 5°/sec speed gate, and `good`/`fair`/`poor` thresholds.
- Recenter preserves user-applied offsets and resets only the current smoothed baseline.
- Manual pan produces the same `CameraPose` shape as live sensors.
- Rear-camera acquisition requests `facingMode: { exact: 'environment' }` first, falls back to `facingMode: 'environment'`, prefers `1280x720`, and never requests microphone access.
- Observer updates remain gated to movement over 25 meters or elapsed time of 15 seconds.
- Projection keeps `0=north`, `90=east`, hides camera-space `z <= 0`, clamps vertical FOV to `40..60`, derives horizontal FOV from aspect ratio, and center-locks within a fixed angular radius of 4°.
- Incomplete `/view` permission payloads remain in preflight status instead of silently entering manual-pan fallback.

## Intended behavior changes

- Delivered the phase sensor/location/projection modules and the dummy-object viewer harness they feed.
- Reworked the viewer shell from a hook-returned aggregate into component-local state/effects so the React lint/compiler rules accept the same runtime behavior.
- Restored pending preflight badges for unknown permission payloads and kept non-camera fallback motion status aligned with the fair-sensor startup state.
- Gated live location, camera, and orientation effects on one shared verified-live predicate so blocked `/view` preflight states stay behaviorally inert instead of arming browser APIs from URL state alone.
- Hardened linting to ignore generated Playwright output directories so `npm run lint` works before and after browser test runs.

## Known non-changes

- No celestial, satellite, or aircraft live data layers yet.
- No persisted alignment offsets, FOV-adjustment UI, or final settings persistence yet.
- No final canvas line/trail rendering yet; this phase keeps the projection harness on dummy objects and reticle behavior.

## Expected side effects

- Browser validation now depends on local Playwright browser/runtime setup in fresh environments.
- `eslint .` no longer depends on whether `test-results/` currently exists.

## Validation performed

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `npx playwright install chromium`
- `npx playwright install-deps chromium`

## Deduplication / centralization

- Kept all pose normalization logic in the dedicated sensor/projection modules instead of duplicating math in the viewer.
- Centralized preflight motion-badge handling in the viewer so incomplete permission payloads do not drift into fallback-only wording.
- Centralized the “verified live viewer state” check in the permission coordinator and reused it for the viewer’s live-effect gating, instead of re-deriving effect eligibility from individual raw route fields.
- Kept the viewer-shell ref/state management local after the lint-driven rewrite rather than splitting the same mutable state across multiple wrapper hooks.

## Rerun note

- Run `run-20260326T020604Z-abe9114e` required no product-code changes for this phase; the checked-in M2 implementation already satisfied the active contract and prior reviewer feedback.
- Files changed in this rerun: `implementation_notes.md`, `decisions.txt`.
- Validation rerun: `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`.
- Preserved invariants in this rerun: no changes to pose normalization, location gating, camera fallback order, center-lock radius, or viewer-shell behavior.
