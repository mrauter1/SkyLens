# Implementation Notes

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: implement
- Phase ID: orientation-pipeline
- Phase Directory Key: orientation-pipeline
- Phase Title: Raw Orientation And Calibration Pipeline
- Scope: phase-local producer artifact

## Files Changed

- `lib/sensors/orientation.ts`
- `tests/unit/orientation-foundation.test.ts`
- `tests/unit/orientation-permission-and-subscription.test.ts`

## Symbols Touched

- Added `OrientationSource`, `LocalFrame`, `RawOrientationSample`, `PoseCalibration`
- Added `worldFromDeviceOrientation()`, `screenBasisInDeviceCoords()`, `rawPoseQuaternionFromSample()`
- Added `createPoseCalibration()`, `createPoseCalibrationFromReferencePose()`, `createPoseCalibrationFromSample()`, `startAbsoluteOrientationSensorProvider()`, `startDeviceOrientationProvider()`
- Added sensor-availability probing in `requestOrientationPermission()` so permission gating and provider startup agree on sensor-only runtimes
- Rewrote `requestOrientationPermission()` and `subscribeToOrientationPose()`
- Preserved manual-mode helpers: `createManualPoseState()`, `applyManualPoseDrag()`, `createManualCameraPose()`

## Checklist Mapping

- Ordered plan item 3: orientation providers now emit `RawOrientationSample` and choose absolute truth from provider/sample semantics
- Ordered plan item 4: raw pose quaternion now comes from matrix/basis construction with explicit screen-angle remapping
- Ordered plan item 5: calibration is now quaternion-based and applied before pose/debug derivation
- Ordered plan item 6: the live sensor render feed now emits quaternion-first `CameraPose` values with derived yaw/pitch/roll
- Ordered plan item 10: orientation unit tests now cover W3C matrix cases, screen-angle invariance, calibration gating, and the explicit iOS permission path

## Assumptions

- `AbsoluteOrientationSensor.populateMatrix()` is treated as a column-major transform; the orientation pipeline reads the top-left `3x3` as basis columns before building the camera quaternion
- Neutral recenter/alignment targets use the app camera basis (`createCameraQuaternion(0, 0, 0)`), not a raw quaternion identity, so calibrated forward remains horizon-centered for existing projection consumers
- Existing viewer code still depends on yaw/pitch/roll and scalar trim settings, so this phase keeps a compatibility shim instead of refactoring viewer state/settings out of scope

## Preserved Invariants

- Manual drag mode remains unchanged and continues using `createCameraQuaternion()`
- `CameraPose` keeps yaw/pitch/roll fields populated for existing viewer UI/debug consumers
- Relative orientation does not report aligned sensor output until a calibration quaternion has been set
- `webkitCompassHeading` is ignored for pose construction

## Intended Behavior Changes

- Sensor pose construction now uses matrix/quaternion math instead of screen-corrected Euler reconstruction
- The iOS/WebKit permission path now calls `DeviceOrientationEvent.requestPermission(true)` explicitly
- `requestOrientationPermission()` now grants the live sensor path when `AbsoluteOrientationSensor` works even if `deviceorientation*` events are absent
- Recenter writes calibration as a quaternion and applies it immediately without smoothing through the old pose

## Known Non-Changes

- No viewer-shell/startup UI changes in this phase
- No camera picker, manual observer, or calibration-reticle UI changes in this phase
- No persisted viewer-settings schema migration in this phase

## Expected Side Effects

- Relative `deviceorientation` streams surface `orientationNeedsCalibration` and a `poor` alignment state until calibration is applied
- A later absolute sample can replace a relative selection because source choice now follows sample truth rather than event-name assumptions

## Validation Performed

- `pnpm vitest run tests/unit/orientation-foundation.test.ts tests/unit/orientation-permission-and-subscription.test.ts tests/unit/projection-camera.test.ts`
- `pnpm vitest run tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`
- Reviewer follow-up validation: `pnpm exec vitest run tests/unit/orientation-foundation.test.ts tests/unit/orientation-permission-and-subscription.test.ts`

## Deduplication / Centralization

- Consolidated pose construction in `createOrientationSample()` and `rawPoseQuaternionFromSample()` so both direct helpers and subscription flow use the same math
- Kept the legacy viewer trim as a single compatibility quaternion layer instead of duplicating Euler offset logic across providers
