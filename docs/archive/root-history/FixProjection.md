Below is a standalone implementation plan for a web-based camera + sensors + projected labels mode that fits the code you showed and is robust across modern mobile browsers, including Android and the mainstream iOS/iPadOS browser path. It is designed for a web app, not WebXR/ARKit. Camera capture, geolocation, and device orientation all require a secure context; requestVideoFrameCallback() and MediaStreamTrack.getCapabilities() are broadly usable on current browsers but are newer than getUserMedia(), so they must be optional enhancements. AbsoluteOrientationSensor and deviceorientationabsolute are useful when present but are not broad enough to be the only implementation path. On iOS/iPadOS, broad compatibility should still assume the WebKit-style path; Apple’s alternative browser-engine entitlements are a special capability introduced for EU apps on iOS 17.4+/iPadOS 18, not a general baseline to depend on.  ￼

1. Product contract

Implement sensor overlay mode with these guarantees:
	1.	The app opens the rear camera inline in the page and renders projected sky labels on top of the visible video.
	2.	The app uses the best available orientation source at runtime:
	•	AbsoluteOrientationSensor with referenceFrame: "screen" when available.
	•	otherwise deviceorientationabsolute or deviceorientation with event.absolute === true.
	•	otherwise plain deviceorientation in relative/calibrated mode.
	•	otherwise manual drag mode.
	3.	The app supports manual alignment even in “absolute” mode, because web heading sources may still have north-reference bias and camera/lens mismatch.
	4.	The app supports camera selection and FOV calibration, because the web camera APIs do not reliably expose enough intrinsics to guarantee exact pixel alignment, and on some iOS devices facingMode: "environment" can land on an ultra-wide rear camera without detailed lens metadata.  ￼

Non-goals:
	•	Do not attempt true SLAM/world-tracked AR.
	•	Do not require WebXR.
	•	Do not depend on native ARKit/ARCore intrinsics.

2. Browser strategy

Use feature detection, not UA-sniffing, for the core runtime. The only browser-family assumption to encode is that the broad iOS/iPadOS path should be treated as the DeviceOrientation + getUserMedia path. DeviceOrientationEvent.requestPermission() is experimental and requires a transient user activation; when absolute is requested, it may also request magnetometer access. AbsoluteOrientationSensor requires accelerometer, gyroscope, and magnetometer permissions in supporting browsers. Screen.orientation is broadly available and should be used when you need the current screen angle.  ￼

Implement these runtime paths:
	•	Path A: Chromium-class enhanced mode
Try AbsoluteOrientationSensor({ frequency: 60, referenceFrame: "screen" }). If it starts successfully, use it as the orientation provider. This path avoids manual screen-axis remapping because the sensor can already resolve readings in screen coordinates.  ￼
	•	Path B: Cross-browser core mode
Listen for both deviceorientationabsolute and deviceorientation. Treat the reading as absolute only if the chosen event actually reports absolute === true; do not infer absoluteness from the event name alone. This path must implement the W3C Z-X’-Y’’ device-orientation math directly.  ￼
	•	Path C: Relative/calibrated mode
If only plain deviceorientation is available with absolute === false, render labels only after a one-tap calibration step. The W3C spec explicitly says relative orientation uses an arbitrary reference frame, so it cannot be used for sky alignment without calibration.  ￼
	•	Path D: Manual mode
If motion permission is denied or no usable orientation source exists, keep the camera if available and let the user pan with drag gestures.

3. Refactor the orientation model

3.1 Replace Euler-first samples with raw world-frame samples

The current lib/sensors/orientation.ts turns alpha/beta/gamma into a camera yaw/pitch/roll model too early. Replace that with a raw sample that carries a rotation matrix from local coordinates into world coordinates.

Add:

export type OrientationSource =
  | 'absolute-sensor'
  | 'deviceorientation-absolute'
  | 'deviceorientation-relative'
  | 'manual'

export type LocalFrame = 'device' | 'screen'

export interface RawOrientationSample {
  source: OrientationSource
  localFrame: LocalFrame
  absolute: boolean
  timestampMs: number
  worldFromLocal: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ]
  compassAccuracyDeg?: number
}

Do not make headingDeg, pitchDeg, and rollDeg the primary runtime state anymore. They can remain as derived debug values only.

3.2 Replace OrientationOffsets with a calibration quaternion

Change calibration from scalar heading/pitch offsets to a persistent quaternion:

export interface PoseCalibration {
  offsetQuaternion: Quaternion   // identity by default
  calibrated: boolean
  sourceAtCalibration: OrientationSource | null
  lastCalibratedAtMs: number | null
}

The final rendered pose becomes:

qPoseFinal = qCalibrationOffset * qRawPose

This avoids the current “extract Euler -> adjust -> rebuild quaternion” loop.

3.3 Keep createCameraQuaternion() only for manual mode

createCameraQuaternion(yaw,pitch,roll) is fine for manual drag mode and unit tests. It must no longer be used to interpret raw sensor data from deviceorientation.

4. Implement the correct sensor math

The Device Orientation spec defines alpha, beta, and gamma as intrinsic Z-X’-Y’’ rotations on the device frame, where device x points to the right side of the screen, y to the top of the screen, and z out of the screen. The spec also explicitly says that changing screen orientation does not change this device coordinate frame. Its augmented-reality example uses the vector [0,0,-1], which points out of the back of the screen. That is exactly the rear-camera forward direction you need.  ￼

4.1 Add matrix helpers in lib/projection/camera.ts

Export or add:
	•	type Mat3 = [[number, number, number], [number, number, number], [number, number, number]]
	•	multiplyMat3Vec3(mat: Mat3, v: Vec3): [number, number, number]
	•	negateVec3(v: Vec3): [number, number, number]
	•	createQuaternionFromBasis(right: Vec3, down: Vec3, forward: Vec3): Quaternion
	•	optionally basisFromQuaternion(quaternion): { right, down, forward }

createQuaternionFromBasis() should just wrap the existing internal quaternionFromRotationMatrix() by feeding it the same column layout already used by createCameraQuaternion().

4.2 DeviceOrientation matrix formula

For deviceorientation, implement the exact W3C rotation matrix:

function worldFromDeviceOrientation(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): Mat3 {
  const a = degreesToRadians(alphaDeg)
  const b = degreesToRadians(betaDeg)
  const g = degreesToRadians(gammaDeg)

  const ca = Math.cos(a), sa = Math.sin(a)
  const cb = Math.cos(b), sb = Math.sin(b)
  const cg = Math.cos(g), sg = Math.sin(g)

  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg,  ca * cb, sa * sg - ca * sb * cg],
    [               -cb * sg,      sb,               cb * cg],
  ]
}

This matrix maps a vector from device-local coordinates into the app’s world frame.

4.3 Generic Sensor path

For AbsoluteOrientationSensor, use referenceFrame: "screen" and populateMatrix() rather than trying to infer semantics from the quaternion alone. The spec defines the absolute orientation sensor as a device-local orientation relative to an Earth frame whose axes are east, magnetic north, and sky-up; the local frame can be either device or screen. Using screen here avoids manual landscape remapping on supporting browsers.  ￼

Implementation rule:
	•	If provider is AbsoluteOrientationSensor({ referenceFrame: "screen" }), populate worldFromLocal directly from the sensor matrix and set localFrame = "screen".

4.4 Build the camera pose from local axes

The camera local basis is:
	•	+X = right on screen
	•	+Y = down on screen
	•	+Z = forward out of the rear camera

For a screen-frame sample:

const rightWorld   = col0(worldFromLocal)
const upWorld      = col1(worldFromLocal)
const downWorld    = negateVec3(upWorld)
const forwardWorld = negateVec3(col2(worldFromLocal))
const qRawPose     = createQuaternionFromBasis(rightWorld, downWorld, forwardWorld)

For a device-frame sample, first remap from current screen axes into device axes using screen.orientation.angle:

function screenBasisInDeviceCoords(screenAngleDeg: number) {
  switch (((screenAngleDeg % 360) + 360) % 360) {
    case 0:
      return {
        screenRightDevice: [1, 0, 0] as Vec3,
        screenUpDevice:    [0, 1, 0] as Vec3,
      }
    case 90:
      return {
        screenRightDevice: [0, 1, 0] as Vec3,
        screenUpDevice:    [-1, 0, 0] as Vec3,
      }
    case 180:
      return {
        screenRightDevice: [-1, 0, 0] as Vec3,
        screenUpDevice:    [0, -1, 0] as Vec3,
      }
    case 270:
      return {
        screenRightDevice: [0, -1, 0] as Vec3,
        screenUpDevice:    [1, 0, 0] as Vec3,
      }
    default:
      // Optional generalized sin/cos version.
  }
}

Then:

const { screenRightDevice, screenUpDevice } = screenBasisInDeviceCoords(angle)
const rightWorld   = multiplyMat3Vec3(worldFromLocal, screenRightDevice)
const upWorld      = multiplyMat3Vec3(worldFromLocal, screenUpDevice)
const downWorld    = negateVec3(upWorld)
const forwardWorld = multiplyMat3Vec3(worldFromLocal, [0, 0, -1])
const qRawPose     = createQuaternionFromBasis(rightWorld, downWorld, forwardWorld)

Important: delete the current runtime path that uses applyScreenOrientationCorrection() and orientLandscapeSampleForPoseContract(). Those are compensating for the wrong model and should not survive this refactor.

4.5 Ignore webkitCompassHeading in pose construction

webkitCompassHeading is non-standard and is a heading quantity, not a replacement for the W3C alpha angle. The spec also notes that alpha is opposite in sense to a compass heading. Do not substitute it into the W3C rotation model. It may be surfaced as a diagnostic or quality hint only.  ￼

5. Calibration and alignment

5.1 Calibration must be built in

Even with an absolute source, the app needs a user-facing Align action, because:
	•	web absolute orientation may be magnetic-north referenced or otherwise implementation-defined,
	•	camera/lens selection may change FOV and center alignment,
	•	phone cases and nearby magnets can bias heading,
	•	iOS/WebKit may choose a wider rear lens than expected.  ￼

5.2 Calibration target selection

Use this priority order:
	1.	Sun, if above horizon and not hidden by your daylight filters.
	2.	Moon, if above horizon.
	3.	Brightest visible planet.
	4.	Brightest visible star.
	5.	Manual “north marker” fallback if no sky body is good enough.

All of that can reuse your existing astronomy pipeline.

5.3 One-tap alignment algorithm

When the user centers a calibration target and taps Align:
	1.	Compute targetForwardWorld = horizontalToWorldVector(target.azimuthDeg, target.elevationDeg).
	2.	Build a desired camera basis:
	•	right = normalize(cross(targetForwardWorld, WORLD_UP))
	•	if right is degenerate, use the current raw camera right vector projected orthogonal to targetForwardWorld
	•	up = normalize(cross(right, targetForwardWorld))
	•	down = -up
	3.	qTarget = createQuaternionFromBasis(right, down, targetForwardWorld)
	4.	qCalibrationOffset = qTarget * inverse(qRawPoseAtTap)

Persist qCalibrationOffset.

This works in both absolute and relative modes. In relative mode, it defines the arbitrary sensor reference frame relative to the real sky. In absolute mode, it trims residual heading/pitch bias.

5.4 Fine adjustment UI

In sensor modes, support a secondary drag-based fine alignment UI:
	•	horizontal drag: left-multiply qCalibrationOffset by a yaw quaternion about world up
	•	vertical drag: left-multiply qCalibrationOffset by a pitch quaternion about the current calibrated camera right vector

Do not expose raw Euler offsets as the primary calibration model.

6. Camera acquisition and video layout

6.1 Camera startup

Use a single top-level Start AR button. In its click handler:
	1.	Request motion/orientation permission immediately if needed.
	2.	Start the rear camera with audio: false.
	3.	Request location.

For the video element, use playsinline, and set it up for inline autoplay on iPhone. Apple documents playsInline, and Safari video guidance explicitly says to use <video playsinline> for inline playback.  ￼

Use this camera-open sequence:
	•	if you already have a persisted deviceId, try that first with video: { deviceId: { exact: ... } }
	•	otherwise try video: { facingMode: { exact: 'environment' } }
	•	if that fails, try video: { facingMode: 'environment' }

getUserMedia() is permission-gated and secure-context only. facingMode is widely supported, and getSettings().facingMode can confirm what was actually chosen.  ￼

6.2 Camera picker

After camera permission succeeds, call enumerateDevices() and build an optional rear-camera picker. enumerateDevices() is secure-context only, default devices are listed first, and non-default devices are permission-gated. Persist the selected deviceId once the user chooses a camera.  ￼

This matters because on some iOS devices, facingMode: environment can resolve to an ultra-wide path and the Web API may not expose enough camera characteristics to infer that automatically. Let the user pick the working rear camera and persist it.  ￼

6.3 Optional track capability handling

If videoTrack.getCapabilities() exists, inspect it and expose optional controls like zoom only when the capability actually exists. This API is newly available on the latest browsers and not guaranteed on older devices. Treat it as optional.  ￼

6.4 Fix the projection-to-video mapping

This is required. The current projectWorldPointToScreen() maps directly into viewport width/height and assumes the entire camera image is visible. That is wrong whenever the <video> is displayed with object-fit: cover.

Refactor projection into two stages:
	1.	Camera ray → image plane using source frame size and FOV.
	2.	Image plane → visible viewport using the video’s fit/crop transform.

Add:

export interface CameraFrameLayout {
  sourceWidth: number
  sourceHeight: number
  viewportWidth: number
  viewportHeight: number
  objectFit: 'cover'
  scale: number
  cropX: number
  cropY: number
}

Compute layout:

const scale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight)
const displayedWidth = sourceWidth * scale
const displayedHeight = sourceHeight * scale
const cropX = (displayedWidth - viewportWidth) / 2
const cropY = (displayedHeight - viewportHeight) / 2

Then map image coordinates:

const imageX = ((normalizedX + 1) / 2) * sourceWidth
const imageY = ((normalizedY + 1) / 2) * sourceHeight

const x = imageX * scale - cropX
const y = imageY * scale - cropY

Modify ProjectViewport / projectWorldPointToScreen() so it accepts sourceWidth and sourceHeight. Use the actual video-frame dimensions, not just CSS box size.

6.5 Use per-frame video metadata when available

If requestVideoFrameCallback() exists, drive the overlay render loop from it and use its frame metadata width/height. MDN notes that the callback is per video frame and that metadata width/height can differ from videoWidth/videoHeight. Fall back to requestAnimationFrame() if requestVideoFrameCallback() is unavailable.  ￼

7. Location and observer state

Request location with:

navigator.geolocation.getCurrentPosition(success, error, {
  enableHighAccuracy: true,
  maximumAge: 30_000,
  timeout: 10_000,
})

Geolocation is secure-context only and permission-gated. If denied or timed out, show a manual observer form for latitude, longitude, and altitude. Persist the manual observer. Do not block the rest of AR startup forever on location; allow manual entry and retry.  ￼

8. Render loop and performance

Split rendering into two rates:
	•	Sky object recompute: every 1 second, or when observer/time/layers change.
	•	Projection/render: every video frame via requestVideoFrameCallback(), else requestAnimationFrame().

Runtime loop:
	1.	Read latest qPoseFinal
	2.	Read latest CameraFrameLayout
	3.	For each visible object:
	•	project world az/el into image plane
	•	map image plane into viewport
	•	apply visibility/overscan rules
	4.	Update DOM positions or canvas draw

Continue to use your current astronomy code, object filtering, and center-lock logic.

9. Permissions and boot flow

Implement a top-level startup controller with these states:
	•	unsupported
	•	ready-to-request
	•	requesting
	•	camera-only
	•	sensor-relative-needs-calibration
	•	sensor-absolute
	•	manual
	•	error

Startup sequence:
	1.	Verify window.isSecureContext
	2.	Show Start AR
	3.	On click:
	•	if DeviceOrientationEvent.requestPermission exists, call requestPermission(true) immediately in that click handler
	•	if DeviceMotionEvent.requestPermission exists, call it too
	•	then start camera
	•	then request geolocation
	•	then start the best orientation provider
	4.	If provider is relative, enter calibration mode before showing labels
	5.	If camera works but motion fails, keep camera and switch to manual pose mode
	6.	If camera fails but motion works, optionally show non-camera sky map

Some browsers require explicit motion permission from a transient user activation; requestPermission(true) may also include magnetometer permission when absolute orientation is needed. getUserMedia() and geolocation are both permission-gated and secure-context only.  ￼

10. Deployment requirements

Serve the app from HTTPS or localhost. If the app is embedded, add explicit feature delegation, or better, avoid cross-origin embedding for the AR screen entirely. Permissions-Policy can block camera, geolocation, and sensor APIs. Use:

Permissions-Policy:
  camera=(self),
  geolocation=(self),
  accelerometer=(self),
  gyroscope=(self),
  magnetometer=(self)

If you must use an iframe, add:

<iframe allow="camera; geolocation; accelerometer; gyroscope; magnetometer"></iframe>

These APIs are all affected by secure-context and permissions-policy rules.  ￼

11. Exact file-by-file changes

lib/projection/camera.ts

Do all of this:
	•	export Mat3
	•	export createQuaternionFromBasis(right, down, forward)
	•	export multiplyMat3Vec3
	•	export negateVec3
	•	add projectWorldPointToImagePlane()
	•	add mapImagePointToViewport()
	•	modify projectWorldPointToScreen() to accept sourceWidth, sourceHeight, and objectFit: 'cover'
	•	keep createCameraQuaternion() only for manual mode and tests
	•	widen FOV calibration range substantially; do not clamp to 40–60 only

lib/sensors/orientation.ts

Rewrite around providers and calibration quaternion:
	•	keep permission helpers, but change iOS request path to DeviceOrientationEvent.requestPermission(true)
	•	add provider selection:
	•	startAbsoluteOrientationSensorProvider()
	•	startDeviceOrientationProvider()
	•	add worldFromDeviceOrientation(alpha,beta,gamma)
	•	add screenBasisInDeviceCoords(angle)
	•	add rawPoseQuaternionFromSample(sample, screenAngle)
	•	change createSensorCameraPose() to:
	•	compute qRawPose
	•	apply qCalibrationOffset
	•	return CameraPose with quaternion only as rendering truth
	•	keep Euler extraction only for debug text if needed
	•	remove these from runtime render logic:
	•	applyScreenOrientationCorrection
	•	orientLandscapeSampleForPoseContract
	•	createOrientationContinuityCandidates
	•	resolveContinuousOrientationSample
	•	getQuaternionHeadingDeg
	•	getQuaternionRollDeg

Viewer state / contracts

Extend state with:
	•	orientationSource
	•	orientationAbsolute
	•	orientationNeedsCalibration
	•	poseCalibration
	•	selectedCameraDeviceId
	•	cameraFrameLayout
	•	fovAdjustmentDeg
	•	observerSource: 'geo' | 'manual'
	•	startupState

Camera/view component

Implement:
	•	<video playsinline autoplay muted>
	•	camera picker sheet
	•	calibration overlay with center reticle
	•	align / reset / fine-adjust controls
	•	sensor-status badge
	•	relative-mode warning badge
	•	secure-context / permission failure screens

12. Testing plan

Unit tests

Add tests for the new math:
	1.	worldFromDeviceOrientation(0, 90, 0) should produce rear-camera forward ≈ north horizon.
	2.	worldFromDeviceOrientation(90, 90, 0) should produce rear-camera forward ≈ west horizon.
	3.	The W3C landscape example (alpha = 270 - heading, beta = 0, gamma = 90) should map to the same forward direction as the equivalent upright pose.
	4.	Switching screen.orientation.angle between 0/90/180/270 should preserve the forward vector of the same physical pose.
	5.	projectWorldPointToScreen() with object-fit: cover must shift x/y correctly when source and viewport aspect ratios differ.

Integration tests

On real devices, test at least:
	•	Safari on iPhone
	•	one Chromium-based Android browser
	•	Samsung Internet or Firefox Android

Acceptance criteria:
	•	No 180° inversion when the phone crosses vertical.
	•	Portrait ↔ landscape rotation does not cause the overlay to jump wildly.
	•	After calibration, a centered calibration target stays close to center through modest pans.
	•	Rear-camera selection persists across reloads.
	•	If motion permission is denied, manual mode still works.
	•	If geolocation is denied, manual observer entry works.

13. Final implementation order

Implement in this exact order:
	1.	Refactor projection for video crop/layout.
	2.	Add quaternion-from-basis helpers.
	3.	Rewrite orientation providers to output RawOrientationSample.
	4.	Build raw pose quaternion from sample.
	5.	Add calibration quaternion and apply it to the raw pose.
	6.	Replace the current sensor render path with the new quaternion path.
	7.	Add startup/permission UI.
	8.	Add camera picker and persistence.
	9.	Add calibration reticle flow.
	10.	Add tests and device QA.

The most important rule for the agent is this:

Do not try to “fix” the current pipeline by tweaking beta or by adding more Euler special cases. Replace the sensor path with a matrix/quaternion pipeline, and handle screen orientation and video crop explicitly.
