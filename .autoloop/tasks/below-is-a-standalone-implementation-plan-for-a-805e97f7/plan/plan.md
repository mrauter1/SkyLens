# Sensor Overlay Mode Plan

## Scope

Implement the supplied web-camera + sensor overlay contract as the live viewer baseline for mobile browsers. Keep the existing astronomy, ranking, demo, and manual-pan foundations where they still fit; replace the current Euler-first sensor pipeline, scalar alignment offsets, and viewport-only projection path.

Non-goals:
- WebXR, SLAM, ARKit/ARCore intrinsics, or native-only camera calibration.
- Repo-wide UI redesign outside the landing screen, viewer shell, and settings/calibration controls touched by the new startup flow.

Intentional behavior changes:
- Live startup no longer hard-blocks on denied/timed-out geolocation; it must fall back to manual observer entry and continue camera/manual-orientation flows.
- Sensor calibration no longer uses persisted heading/pitch nudges as the primary model; it moves to a persisted quaternion calibration plus fine adjustment.
- Projection must use real video source dimensions plus `object-fit: cover` crop instead of mapping directly into CSS viewport space.

## Current Delta

- [`lib/sensors/orientation.ts`](/workspace/SkyLens/lib/sensors/orientation.ts) currently derives yaw/pitch/roll too early, depends on `applyScreenOrientationCorrection()` and `orientLandscapeSampleForPoseContract()`, and treats `webkitCompassHeading` as authoritative heading input.
- [`lib/projection/camera.ts`](/workspace/SkyLens/lib/projection/camera.ts) currently projects straight into viewport width/height and clamps vertical FOV to 40–60 degrees.
- [`lib/permissions/coordinator.ts`](/workspace/SkyLens/lib/permissions/coordinator.ts), [`components/landing/landing-screen.tsx`](/workspace/SkyLens/components/landing/landing-screen.tsx), and [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) currently encode a landing-page preflight flow and a location-required blocked state that conflict with the requested in-view startup controller.
- [`components/settings/settings-sheet.tsx`](/workspace/SkyLens/components/settings/settings-sheet.tsx) and [`lib/viewer/settings.ts`](/workspace/SkyLens/lib/viewer/settings.ts) currently expose scalar heading/pitch/FOV sliders instead of quaternion calibration, camera selection, and fine adjust controls.
- Existing tests in [`tests/unit/orientation-foundation.test.ts`](/workspace/SkyLens/tests/unit/orientation-foundation.test.ts), [`tests/unit/orientation-permission-and-subscription.test.ts`](/workspace/SkyLens/tests/unit/orientation-permission-and-subscription.test.ts), [`tests/unit/projection-camera.test.ts`](/workspace/SkyLens/tests/unit/projection-camera.test.ts), [`tests/unit/permission-coordinator.test.ts`](/workspace/SkyLens/tests/unit/permission-coordinator.test.ts), and [`tests/e2e/permissions.spec.ts`](/workspace/SkyLens/tests/e2e/permissions.spec.ts) assert the old contracts and must be updated, not preserved.

## Target Contracts

### Projection and Camera Math

- `lib/projection/camera.ts`
  - Export `Mat3`, `CameraFrameLayout`, `multiplyMat3Vec3()`, `negateVec3()`, and `createQuaternionFromBasis()`.
  - Add `projectWorldPointToImagePlane()` and `mapImagePointToViewport()`.
  - Change `projectWorldPointToScreen()` so it projects with real source frame dimensions and a precomputed `CameraFrameLayout` for `object-fit: cover`.
  - Keep `createCameraQuaternion()` only for manual mode and tests.
  - Widen FOV adjustment range enough to support real camera/lens calibration; do not keep the 40–60 degree clamp.

### Orientation Pipeline

- `lib/sensors/orientation.ts`
  - Add `OrientationSource`, `LocalFrame`, `RawOrientationSample`, and `PoseCalibration`.
  - Implement `worldFromDeviceOrientation(alpha,beta,gamma)` exactly from the W3C Z-X'-Y'' matrix formula.
  - Add provider selection in priority order: `AbsoluteOrientationSensor(referenceFrame: 'screen')`, absolute `deviceorientation*`, relative `deviceorientation`, manual fallback.
  - Change the iOS/WebKit permission helper path to call `DeviceOrientationEvent.requestPermission(true)` from the `Start AR` user activation, request `DeviceMotionEvent.requestPermission()` in the same activation when present, and keep Generic Sensor permission failures non-fatal so deviceorientation/manual fallbacks still activate.
  - Derive `qRawPose` from basis vectors built from `worldFromLocal`; apply `qPoseFinal = qCalibrationOffset * qRawPose`.
  - Remove the current runtime use of `applyScreenOrientationCorrection()`, `orientLandscapeSampleForPoseContract()`, continuity candidates, and quaternion-to-Euler heading/roll extraction helpers from live pose construction.
  - Treat `webkitCompassHeading` as diagnostic-only; never feed it into the pose math.
  - Keep derived Euler values only as optional debug/status output.

### Calibration and Alignment

- Calibration target selection must follow the supplied product order and remain deterministic:
  - Sun if above horizon and not filtered out by daylight rules.
  - Otherwise Moon if above horizon.
  - Otherwise brightest visible planet.
  - Otherwise brightest visible star.
  - Otherwise manual north-marker fallback.
- Reuse the existing astronomy pipeline to choose the preferred target; do not introduce a separate ranking subsystem for calibration-only target discovery.
- One-tap align and fine adjust remain quaternion-based, and the manual north-marker path must work when no suitable sky body is available.

### Viewer Runtime State

- Extend viewer/runtime contracts with:
  - `orientationSource`
  - `orientationAbsolute`
  - `orientationNeedsCalibration`
  - `poseCalibration`
  - `selectedCameraDeviceId`
  - `cameraFrameLayout`
  - `fovAdjustmentDeg`
  - `observerSource: 'geo' | 'manual'`
  - `startupState: 'unsupported' | 'ready-to-request' | 'requesting' | 'camera-only' | 'sensor-relative-needs-calibration' | 'sensor-absolute' | 'manual' | 'error'`
- Keep demo mode intact.
- Make the quaternion the only rendering truth in `CameraPose`; yaw/pitch/roll remain debug-oriented compatibility fields until all consumers stop needing them.

### Startup / Permissions / Persistence

- Replace landing-page permission preflight with an in-view `Start AR` controller so the same user activation can request motion permission, open camera, and attach inline video.
- Keep the landing page as the entry surface, but it should navigate to the viewer instead of consuming the live permission flow itself.
- The `Start AR` click order stays explicit: request motion/orientation permission first, then start the rear camera, then request location/manual-observer fallback.
- The live camera element must be configured for inline mobile playback with `<video playsInline autoPlay muted>`.
- Update permission coordination so camera/motion can continue when geolocation fails, with a manual observer form and retry path.
- Persist camera device selection and quaternion calibration alongside existing viewer settings.
- Migrate storage conservatively: preserve layers, label mode, FOV, and onboarding; initialize quaternion calibration to identity; do not translate old heading/pitch offset nudges into the new calibration model.

### Deployment / Embedding

- Live AR must be served from HTTPS or `localhost`; startup must gate on `window.isSecureContext` and surface a first-class unsupported/error state when that requirement is not met.
- Prefer not to embed the AR screen cross-origin. If embedding is unavoidable, plan for both the response header and iframe delegation:
  - `Permissions-Policy: camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)`
  - `<iframe allow="camera; geolocation; accelerometer; gyroscope; magnetometer">`
- Deployment validation must explicitly confirm that camera, geolocation, and sensor APIs are not being blocked by hosting or embed policy before browser-specific debugging begins.

## Ordered Implementation Plan

1. **Projection layout refactor**
   - Add image-plane projection helpers and `CameraFrameLayout`.
   - Thread source frame width/height through projection callers.
   - Update object projection and center-lock consumers to use the new mapping.
   - Regression focus: preserve visibility/overscan behavior while fixing `cover` crop drift.

2. **Quaternion/basis helpers**
   - Export the matrix and basis helpers from [`lib/projection/camera.ts`](/workspace/SkyLens/lib/projection/camera.ts).
   - Keep manual-mode quaternion creation unchanged for drag mode and existing tests that still model manual control.

3. **Orientation providers produce raw samples**
   - Rewrite orientation subscription around raw world-frame samples instead of normalized Euler samples.
   - Implement sensor provider selection and permission handling for Generic Sensor and `deviceorientation`.
   - Carry `absolute` truth from the active sample, not the event name.

4. **Raw pose construction**
   - Add `screenBasisInDeviceCoords()` and build camera basis vectors from sample matrices.
   - Derive `qRawPose` for both `screen` and `device` local frames.
   - Delete the old screen-correction/landscape compensation path once replacement tests pass.

5. **Calibration quaternion**
   - Introduce `PoseCalibration`, calibration persistence, and the align/reset/fine-adjust APIs.
   - Implement the required calibration-target priority: Sun → Moon → brightest visible planet → brightest visible star → manual north marker.
   - Implement one-tap target alignment and fine-adjust quaternion updates.
   - Keep manual drag as the fallback mode when no sensor provider is usable.

6. **Viewer render path swap**
   - Replace the existing sensor render path so projected labels read only `qPoseFinal`.
   - Update alignment status badges to report source, absolute/relative state, and calibration requirement instead of only noisy/fair/good.
   - Keep astronomy scene generation, label ranking, and center-lock behavior otherwise intact.

7. **Startup and permission UI**
   - Add the in-view startup controller, secure-context/unsupported states, and explicit error/manual fallback states.
   - Encode the iOS/WebKit `DeviceOrientationEvent.requestPermission(true)` path and request motion/orientation before camera startup in the same activation.
   - Remove the location-required hard block and add manual observer entry/retry.
   - Keep the viewer accessible when motion is denied by switching to manual pose mode with camera if available.

8. **Camera selection and persistence**
   - Add persisted `deviceId` preference, camera-open retry order, and rear-camera picker once permission is granted.
   - Expose optional zoom controls only when `getCapabilities()` is available and reports support.
   - Capture actual video frame dimensions via `requestVideoFrameCallback()` when available, else `requestAnimationFrame()`.

9. **Calibration reticle and controls**
   - Add a center reticle, align action, reset action, sensor-status badge, relative-mode warning, and fine-adjust UI.
   - Replace settings-sheet scalar heading/pitch controls with calibration-aware controls and FOV calibration.

10. **Tests and device QA**
   - Replace old Euler continuity assertions with matrix/quaternion pose tests, including the required portrait/landscape invariance cases.
   - Update permission/startup tests for manual observer fallback and in-view Start AR flow.
   - Add projection tests for `object-fit: cover` crop mapping and live frame metadata.
   - Perform real-device QA on iPhone Safari, one Chromium Android browser, and Samsung Internet or Firefox Android.

## Compatibility and Migration Notes

- Storage schema should advance to a new version or compatible parser path that can read the old payload safely. Required preserved fields: enabled layers, likely-visible-only, label mode, vertical FOV adjustment, onboarding status. Required new fields: camera device ID, pose calibration, optional manual observer.
- Demo routing stays supported. Live-mode query-param seeded permission states are no longer the source of truth for production startup; tests may keep explicit seeds only if they do not bypass the real startup controller behavior being validated.
- The viewer must continue to render a non-camera sky map when camera access fails but sensor/location/manual observer data are available.
- `CameraPose` consumers outside the viewer must tolerate yaw/pitch/roll becoming derived/debug values rather than primary sensor state.
- Hosting and embed compatibility are part of the shipped contract, not post-implementation cleanup: the implementation must be validated under HTTPS/localhost and with the required permissions-policy/iframe delegation rules when the viewer is embedded.

## Regression Controls

- Preserve existing astronomy calculations, label ranking, and demo scenario outputs unless a change is required by the new camera/sensor projection model.
- Remove old orientation compensation only after replacement invariants are covered:
  - no 180 degree inversion through vertical crossing
  - portrait/landscape rotation preserves forward direction
  - relative mode never renders uncalibrated labels as if absolute
- Validate that projection uses video source dimensions, not CSS box size, before updating UI placement code broadly.
- Treat secure-context failure, permission denial, and unavailable APIs as first-class states; do not let startup hang on unresolved permission promises.
- Do not let calibration UI drift from the requested target priority or omit the manual north-marker fallback when no visible sky object qualifies.
- Keep camera streams and orientation subscriptions single-owned in the viewer shell; cleanup must stop tracks, detach video, and unsubscribe providers on mode changes/unmount.

## Risk Register

- **Orientation semantic mismatch**
  - Risk: wrong axis/basis assumptions can invert east/west or break landscape rotation.
  - Mitigation: lock tests to forward-vector expectations, screen-angle invariance, and W3C formula cases before deleting old code.
- **Projection crop regression**
  - Risk: labels appear systematically shifted on devices where video is cropped by `cover`.
  - Mitigation: centralize layout math in one helper and test mismatched source/viewport aspect ratios.
- **Startup gesture regression**
  - Risk: moving the start flow off the landing page can break motion permission or autoplay assumptions.
  - Mitigation: keep `Start AR` on the page that owns the `<video playsInline autoPlay muted>` element and test real-device boot order.
- **Persistence drift**
  - Risk: old heading/pitch offsets pollute new calibration or stale camera IDs break startup.
  - Mitigation: discard legacy offset migration, validate persisted device IDs with fallback retry order, and surface reset controls.
- **Viewer-shell complexity**
  - Risk: folding camera, location, sensor, and calibration logic into one component increases churn risk.
  - Mitigation: extract only small ownership-focused helpers/hooks where needed; do not add generic abstraction layers.

## Validation and Rollback

- Validation gates before merge:
  - unit coverage for orientation math, projection mapping, storage migration, and startup-state transitions
  - integration coverage for camera/manual/sensor fallback combinations
  - compatibility coverage for the `DeviceOrientationEvent.requestPermission(true)` iOS/WebKit path and deployment policy requirements
  - real-device verification of the acceptance criteria from the request
- Rollback strategy:
  - keep demo mode and manual pan working independently throughout the refactor
  - land projection/orientation foundations before removing the old runtime path
  - if a late-stage regression appears on device, disable the new live sensor overlay path behind a narrow viewer-state guard rather than reverting unrelated astronomy/demo changes
