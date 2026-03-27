# Implementation Notes

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: implement
- Phase ID: projection-foundations
- Phase Directory Key: projection-foundations
- Phase Title: Projection And Basis Foundations
- Scope: phase-local producer artifact

## Files changed

- `lib/projection/camera.ts`
- `tests/unit/projection-camera.test.ts`

## Symbols touched

- `ProjectViewport`
- `Mat3`
- `CameraFrameLayout`
- `ProjectedImagePlanePoint`
- `ViewportMappedPoint`
- `getEffectiveVerticalFovDeg()`
- `createQuaternionFromBasis()`
- `createCameraFrameLayout()`
- `projectWorldPointToImagePlane()`
- `mapImagePointToViewport()`
- `projectWorldPointToScreen()`
- `multiplyMat3Vec3()`
- `negateVec3()`

## Checklist mapping

- Plan step 1 `Projection layout refactor`: completed with source-frame-aware image-plane projection plus `object-fit: cover` viewport mapping.
- Plan step 2 `Quaternion/basis helpers`: completed with exported `Mat3`, `createQuaternionFromBasis()`, `multiplyMat3Vec3()`, and `negateVec3()`.
- Active-phase deliverable `Projection unit tests covering cover-crop mapping and FOV range changes`: completed in `tests/unit/projection-camera.test.ts`.
- Deferred by phase scope: viewer/video metadata wiring, startup UI, camera picker, and sensor-provider integration.

## Assumptions

- Existing callers that only know CSS viewport size must keep working in this phase, so `sourceWidth`/`sourceHeight` default to `width`/`height`.
- This phase only needs the `cover` video-fit contract.

## Preserved invariants

- Manual quaternion behavior is unchanged because `createCameraQuaternion()` still builds the same basis.
- `projectWorldPointToScreen()` still returns the same shape and overscan semantics for callers that omit source-frame dimensions.
- Hidden-behind-camera handling still returns `visible: false` with `NaN` screen/image coordinates.

## Intended behavior changes

- Projection now uses source-frame dimensions when provided and maps image-plane coordinates into the visible viewport after `cover` crop.
- Vertical FOV calibration clamps are widened from `40..60` to `20..100`.

## Known non-changes

- Viewer settings persistence/UI still clamp the exposed FOV adjustment separately; widening the live settings controls is deferred.
- Live viewer callers are not yet threaded with video-frame metadata in this phase.

## Expected side effects

- Later orientation/provider work can construct poses directly from exported basis/matrix helpers without duplicating rotation-matrix logic.
- Callers can opt into real camera-frame projection immediately by supplying `sourceWidth` and `sourceHeight`.

## Validation performed

- `npm test -- --run tests/unit/projection-camera.test.ts tests/unit/celestial-layer.test.ts`
- `npm test -- --run tests/unit/satellite-layer.test.ts`
- `npx tsc --noEmit`:
  Pre-existing unrelated test typing failures remain in `tests/unit/aircraft-layer.test.ts`, `tests/unit/orientation-permission-and-subscription.test.ts`, and `tests/unit/permission-coordinator.test.ts`.

## Deduplication / centralization

- Centralized `cover` layout math in `createCameraFrameLayout()` and reused it from `projectWorldPointToScreen()` rather than duplicating crop calculations at call sites.
