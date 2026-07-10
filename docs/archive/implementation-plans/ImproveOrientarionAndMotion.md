Use the plan below as the single source of truth for the orientation/motion compatibility refactor.

The implementation target is highest practical browser compatibility across:
	•	iOS Safari
	•	Chrome for Android
	•	Firefox for Android
	•	Samsung Internet for Android

The browser facts the implementation must respect are:
	•	deviceorientation is broadly available on current mobile browsers, but only in secure contexts. DeviceOrientationEvent.requestPermission() / DeviceMotionEvent.requestPermission() are limited-availability, require transient user activation, and requestPermission(true) also requests magnetometer access for absolute orientation.  ￼
	•	iOS Safari requires calling DeviceMotionEvent.requestPermission() or DeviceOrientationEvent.requestPermission() from a user gesture on iOS/iPadOS Safari, and Safari exposes non-standard webkitCompassHeading / webkitCompassAccuracy on orientation events.  ￼
	•	Chrome for Android changed plain deviceorientation so it is not the absolute Earth-referenced path by default; absolute data is exposed via deviceorientationabsolute, and the absolute flag must be respected. Chrome-family browsers also support the Generic Sensor family, including AbsoluteOrientationSensor, RelativeOrientationSensor, and referenceFrame: 'screen'.  ￼
	•	Firefox for Android supports orientation events in secure contexts, but Mozilla still has an open bug to implement the static requestPermission() methods, so the code must not depend on those methods existing there.  ￼
	•	Samsung Internet should be treated as a Chromium-family browser with version lag and compatibility drift: Samsung says it is a Chrome fork maintained by Samsung, tries to stay compatible with Chromium, and can still have unexpected differences; its release notes explicitly track Chromium engine upgrades.  ￼
	•	Do not use devicemotion for pose fallback. MDN explicitly warns that Firefox and Chrome do not handle DeviceMotion coordinates the same way.  ￼
	•	For Generic Sensor APIs, absolute orientation depends on accelerometer + gyroscope + magnetometer; relative orientation depends on accelerometer + gyroscope; these can also be blocked by Permissions Policy, and the default allowlist for gyroscope and magnetometer is self.  ￼

1. Objective

Refactor the orientation stack so SkyLens always uses the best provider that is actually working on the current browser/device, instead of assuming one API shape is universal.

End-state behavior:
	•	Absolute source available → use it, no mandatory calibration
	•	Only relative source available → use it, but require calibration before trust
	•	No working source → manual fallback

This refactor must preserve the current working iOS Safari behavior, improve Android compatibility, and make provider selection resilient to browser differences and provider stalls.

2. Scope

Primary implementation files:
	•	lib/sensors/orientation.ts
	•	components/viewer/viewer-shell.tsx

Tests to add or update:
	•	add tests/unit/orientation.test.ts
	•	update tests/unit/viewer-shell.test.ts

Optional config file if headers are centralized there:
	•	next.config.js or next.config.ts

3. Non-goals

Do not do any of the following in this branch:
	•	do not add devicemotion as a pose source
	•	do not rewrite manual pan controls
	•	do not replace the current Safari event path with a sensor-only path
	•	do not rely on UA detection for core provider selection
	•	do not collapse permission prompting and provider readiness into one boolean
	•	do not change camera projection math unless a new helper is strictly needed

4. Provider ladder

The runtime must implement this exact provider preference order:
	1.	AbsoluteOrientationSensor({ referenceFrame: 'screen' })
	2.	deviceorientationabsolute
	3.	deviceorientation where event.absolute === true
	4.	Safari compass-backed validated event path
(deviceorientation with finite webkitCompassHeading, but only after validation described below)
	5.	RelativeOrientationSensor({ referenceFrame: 'screen' })
	6.	deviceorientation relative fallback
	7.	manual fallback

Important: the “Safari compass-backed validated event path” is not just “webkitCompassHeading exists, so mark absolute.” It must be validated before it disables calibration.

5. Public type changes in lib/sensors/orientation.ts

5.1 Extend OrientationSource

Change:

export type OrientationSource =
  | 'absolute-sensor'
  | 'deviceorientation-absolute'
  | 'deviceorientation-relative'
  | 'manual'

to:

export type OrientationSource =
  | 'absolute-sensor'
  | 'relative-sensor'
  | 'deviceorientation-absolute'
  | 'deviceorientation-relative'
  | 'manual'

Do not add a public deviceorientation-compass enum. Keep public source labels stable.

5.2 Extend DeviceOrientationReading

Add:

webkitCompassAccuracy?: number

5.3 Replace RawOrientationSample

Use this exact shape:

export interface RawOrientationSample {
  source: OrientationSource
  providerKind: 'sensor' | 'event'
  localFrame: LocalFrame
  absolute: boolean
  timestampMs: number
  worldFromLocal?: Mat3
  rawQuaternion?: Quaternion
  compassBacked?: boolean
  compassHeadingDeg?: number
  compassAccuracyDeg?: number
}

5.4 Extend OrientationSample

Add:

reportedCompassHeadingDeg?: number
compassAccuracyDeg?: number
compassBacked?: boolean

5.5 Extend OrientationRuntime

Add support for relative sensors and permissions querying:

RelativeOrientationSensor?: RelativeOrientationSensorConstructor
permissions?: Pick<Permissions, 'query'>

Also define:

interface RelativeOrientationSensorLike extends AbsoluteOrientationSensorLike {}

interface RelativeOrientationSensorConstructor {
  new (options?: {
    frequency?: number
    referenceFrame?: 'device' | 'screen'
  }): RelativeOrientationSensorLike
}

5.6 Add internal capability/state types

Add:

interface OrientationCapabilities {
  hasEvents: boolean
  hasAbsoluteEvent: boolean
  hasAbsoluteSensor: boolean
  hasRelativeSensor: boolean
  canRequestPermission: boolean
}

interface PermissionHints {
  accelerometer?: PermissionState | 'unsupported'
  gyroscope?: PermissionState | 'unsupported'
  magnetometer?: PermissionState | 'unsupported'
}

interface OrientationProviderController {
  id: OrientationSource
  absolute: boolean
  priority: number
  stop(): void
}

6. Constants

Replace or add these constants:

const DEFAULT_SMOOTHING = 0.2
const DEFAULT_MANUAL_YAW_PER_PIXEL = 0.12
const DEFAULT_MANUAL_PITCH_PER_PIXEL = 0.12

const ORIENTATION_PERMISSION_PROBE_TIMEOUT_MS = 750
const ORIENTATION_PROVIDER_SELECTION_TIMEOUT_MS = 500
const ORIENTATION_ABSOLUTE_UPGRADE_WINDOW_MS = 5_000
const ORIENTATION_PROVIDER_STALL_TIMEOUT_MS = 1_500
const ORIENTATION_MIN_CONSECUTIVE_SAMPLES_FOR_UPGRADE = 2

const SAFARI_COMPASS_VALIDATION_SAMPLES = 3
const SAFARI_COMPASS_MAX_ACCURACY_DEG = 20
const SAFARI_COMPASS_MAX_HEADING_DELTA_DEG = 20

const BASIS_EPSILON = 1e-6

Delete the old ORIENTATION_STREAM_SELECTION_TIMEOUT_MS = 150.

7. Capability detection

Add these helpers:

function supportsRelativeOrientationSensor(
  currentWindow: Pick<OrientationRuntime, 'RelativeOrientationSensor'>,
) {
  return typeof currentWindow.RelativeOrientationSensor === 'function'
}

function getOrientationCapabilities(
  runtime?: OrientationRuntime,
): OrientationCapabilities

Implementation rules for getOrientationCapabilities():
	•	hasEvents → supportsOrientationEvents
	•	hasAbsoluteEvent → supportsAbsoluteOrientationEvents
	•	hasAbsoluteSensor → supportsAbsoluteOrientationSensor
	•	hasRelativeSensor → supportsRelativeOrientationSensor
	•	canRequestPermission → true if either static request method exists

This function must not start listeners or sensors.

8. Permission prompting

Keep requestOrientationPermission(runtime?), but redefine it as a prompt-only function.

Exact behavior
	1.	If there is no runtime/window → return 'unavailable'
	2.	If there are no events and no sensor constructors → return 'unavailable'
	3.	If DeviceOrientationEvent.requestPermission exists, call DeviceOrientationEvent.requestPermission(true) inside the user gesture
	4.	If DeviceMotionEvent.requestPermission exists, call DeviceMotionEvent.requestPermission()
	5.	If either explicit request returns 'denied' → return 'denied'
	6.	If any explicit request returns 'granted' → return 'granted'
	7.	If both explicit request APIs are absent → return 'unavailable'

It must not probe events or sensors for readiness. That is a separate phase.

This preserves Safari’s required permission prompt and avoids breaking Firefox/Chrome where the static methods may be missing.  ￼

9. Permissions API hints

Add:

async function querySensorPermissionHints(
  runtime: OrientationRuntime,
): Promise<PermissionHints>

Implementation rules:
	•	query accelerometer
	•	query gyroscope
	•	query magnetometer
	•	wrap every query in try/catch
	•	return 'unsupported' on failure
	•	use hints only to suppress sensor startup when the browser explicitly reports denied
	•	never block fallback providers when query is unsupported or fails

This is only a hint layer. Real provider readiness must still come from actual emitted samples.  ￼

10. Sensor providers

10.1 Improve startAbsoluteOrientationSensorProvider

Keep the function, but change it to:
	•	consult permission hints
	•	skip startup only if accelerometer, gyroscope, or magnetometer is explicitly denied
	•	construct with { frequency: 60, referenceFrame: 'screen' }
	•	support both:
	•	sensor.populateMatrix(...)
	•	sensor.quaternion
	•	emit:
	•	source: 'absolute-sensor'
	•	providerKind: 'sensor'
	•	absolute: true
	•	localFrame: 'screen'

If populateMatrix is unavailable but sensor.quaternion exists, emit rawQuaternion.

10.2 Add startRelativeOrientationSensorProvider

Add:

export function startRelativeOrientationSensorProvider(
  onSample: (sample: RawOrientationSample) => void,
  {
    runtime,
    onUnavailable,
  }: {
    runtime?: OrientationRuntime
    onUnavailable?: () => void
  } = {},
)

Behavior:
	•	feature-detect RelativeOrientationSensor
	•	consult permission hints
	•	skip only if accelerometer or gyroscope is explicitly denied
	•	construct with { frequency: 60, referenceFrame: 'screen' }
	•	same matrix/quaternion read logic as absolute sensor
	•	emit:
	•	source: 'relative-sensor'
	•	providerKind: 'sensor'
	•	absolute: false
	•	localFrame: 'screen'

This is the preferred Android non-compass fallback on Chromium-family browsers.  ￼

11. Event provider

Rewrite startDeviceOrientationProvider() so it attaches to both:
	•	deviceorientationabsolute
	•	deviceorientation

Classification rules

When an event arrives:
	1.	ignore it if alpha, beta, or gamma is not numeric
	2.	if event.type === 'deviceorientationabsolute' → classify as absolute
	3.	else if event.absolute === true → classify as absolute
	4.	else if finite webkitCompassHeading exists → classify as relative by default, but mark:
	•	compassBacked: true
	•	compassHeadingDeg
	•	compassAccuracyDeg
	5.	else → classify as relative

Emit:
	•	source: 'deviceorientation-absolute' for cases 2 and 3
	•	source: 'deviceorientation-relative' for cases 4 and 5
	•	providerKind: 'event'
	•	localFrame: 'device'
	•	absolute according to the classification above

This is intentional. A finite webkitCompassHeading alone does not automatically disable calibration. It creates a compass-backed relative candidate that can later be upgraded after validation.

This preserves the current working Safari path and avoids prematurely treating Safari event quaternions as Earth-locked when only the compass metadata is trustworthy.  ￼

12. Raw pose creation

Refactor rawPoseQuaternionFromSample() so it accepts both matrix-backed and quaternion-backed raw samples.

Rules
	1.	If rawSample.rawQuaternion exists:
	•	if localFrame === 'screen', use it directly
	•	if localFrame === 'device', apply screen correction before use
	2.	Else if rawSample.worldFromLocal exists:
	•	keep the existing basis-to-quaternion logic
	3.	Else:
	•	throw internally or return a safe failure signal; do not silently continue

Add a helper if needed:

function applyScreenCorrectionToQuaternion(
  quaternion: Quaternion,
  screenAngleDeg: number,
): Quaternion

Use this only for localFrame: 'device'.

Do not manually apply screen correction to sensor providers already created with referenceFrame: 'screen'.  ￼

13. Safari compass validation upgrade

This is the key Safari-specific update.

The code must support a validated upgrade from a compass-backed relative event stream to an absolute-equivalent stream.

Why

Safari exposes webkitCompassHeading / webkitCompassAccuracy, but the event path should not be trusted as absolute just because those fields exist. The upgrade must be earned.  ￼

Exact algorithm

When the currently selected provider is deviceorientation-relative and incoming samples have:
	•	compassBacked === true
	•	finite compassHeadingDeg
	•	compassAccuracyDeg <= SAFARI_COMPASS_MAX_ACCURACY_DEG

then compute:

delta = abs(shortestAngleDeltaDeg(quaternionDerivedHeadingDeg, compassHeadingDeg))

Maintain a rolling validation buffer.

Upgrade the stream to absolute-equivalent only after:
	•	SAFARI_COMPASS_VALIDATION_SAMPLES consecutive compass-backed samples
	•	each with delta <= SAFARI_COMPASS_MAX_HEADING_DELTA_DEG
	•	each with acceptable compassAccuracyDeg

When the upgrade succeeds:
	•	treat the current provider as deviceorientation-absolute
	•	set absolute = true
	•	set needsCalibration = false
	•	clear smoothing/history once
	•	continue using the existing quaternion math
	•	keep carrying reportedCompassHeadingDeg and compassAccuracyDeg

If validation later fails badly for a sustained period:
	•	downgrade back to deviceorientation-relative
	•	restore needsCalibration = true

This preserves current iOS Safari behavior and improves it only when the compass-backed event stream proves itself internally.

14. createOrientationSample() changes

Update createOrientationSample() so it:
	•	copies compassBacked
	•	copies reportedCompassHeadingDeg
	•	copies compassAccuracyDeg
	•	computes rawQuaternion
	•	computes calibrated quaternion as today
	•	computes debug angles as today

needsCalibration rule

Use this exact logic:

needsCalibration =
  !rawSample.absolute && !calibration.calibrated

That means:
	•	true absolute sensors/events → no required calibration
	•	relative sensors/events → calibration required
	•	Safari validated upgrade → rawSample.absolute has already been upgraded to true, so no required calibration

15. computeAlignmentHealth() changes

Keep the current motion/stability heuristic, then add:
	•	if compassAccuracyDeg is finite:
	•	<= 20 → no penalty
	•	> 20 && <= 45 → cap result at 'fair'
	•	> 45 → cap result at 'poor'

Apply this only to sources that are absolute or compass-backed.

This improves Safari diagnostics without replacing the current pose math.  ￼

16. Provider arbitration and failover

Rewrite subscribeToOrientationPose() as a provider coordinator.

16.1 Provider priorities

Use:

const PROVIDER_PRIORITY: Record<Exclude<OrientationSource, 'manual'>, number> = {
  'absolute-sensor': 100,
  'deviceorientation-absolute': 90,
  'relative-sensor': 70,
  'deviceorientation-relative': 60,
}

16.2 Startup arbitration

At startup:
	1.	build all plausible providers:
	•	absolute sensor
	•	relative sensor
	•	event provider
	2.	start them all
	3.	buffer candidates for ORIENTATION_PROVIDER_SELECTION_TIMEOUT_MS
	4.	pick:
	•	highest-priority absolute provider if any emitted
	•	else highest-priority relative provider if any emitted
	•	else fail startup

16.3 Absolute upgrade window

If the selected provider is relative:
	•	keep listening for a better absolute provider for ORIENTATION_ABSOLUTE_UPGRADE_WINDOW_MS
	•	upgrade only after:
	•	ORIENTATION_MIN_CONSECUTIVE_SAMPLES_FOR_UPGRADE valid samples from that provider

This upgrade path applies both to:
	•	real absolute providers appearing late
	•	Safari compass-backed validated event upgrade

16.4 Stall detection

Track lastSeenMs for the selected provider.

If no sample arrives for ORIENTATION_PROVIDER_STALL_TIMEOUT_MS:
	•	stop all providers
	•	restart arbitration
	•	preserve calibration state

If the chosen provider throws or signals unavailability:
	•	stop all providers
	•	restart arbitration
	•	preserve calibration state

16.5 Source changes

When the selected source changes:
	•	clear smoothedSample
	•	clear history
	•	emit fresh state from the new source

17. Lifecycle handling

Add orientation lifecycle handling.

Stop providers on
	•	document.visibilitychange to hidden
	•	pagehide

Restart arbitration on
	•	document.visibilitychange back to visible
	•	pageshow

Screen rotation

Continue using:
	•	screen.orientation.angle first
	•	window.orientation fallback

For event providers, recompute screen correction whenever orientation changes.

For sensor providers using referenceFrame: 'screen', do not apply extra correction.

18. ViewerShell integration

Update components/viewer/viewer-shell.tsx so it stops assuming “prompt granted = orientation ready.”

18.1 Startup flow

When Start AR is pressed:
	1.	call requestOrientationPermission()
	2.	if it returns 'denied':
	•	preserve the current denied UX
	3.	if it returns 'granted' or 'unavailable':
	•	start subscribeToOrientationPose()
	•	keep route orientation state as 'unknown' until the first usable sample arrives

18.2 Ready transition

When the first usable OrientationSample arrives:
	•	if the route orientation state is not 'granted', replace it with 'granted'

18.3 Failure transition

If startup times out with no providers:
	•	if there are no APIs at all → route state 'unavailable'
	•	if APIs exist but no usable provider produced samples after user action → route state 'denied'

18.4 Status text

Expose more specific motion status labels:
	•	Absolute sensor
	•	Absolute event
	•	Relative sensor
	•	Relative event
	•	Manual

Do not flatten them into one “sensor” label.

18.5 Recovery copy

Add a tiny browser-family helper for copy only:

type BrowserFamily =
  | 'ios-safari'
  | 'chrome-android'
  | 'firefox-android'
  | 'samsung-internet'
  | 'other'

Use it only for recovery/help text:
	•	iOS Safari: explain the Safari motion/orientation permission prompt
	•	Chrome Android: explain motion sensors/site permissions
	•	Firefox Android: say relative mode may require alignment on this browser/device
	•	Samsung Internet: say Chromium-like behavior may vary by version

Do not use browser family for provider selection.

19. Diagnostics

Add a development-only diagnostics block or overlay that shows:
	•	selected provider source
	•	provider kind (sensor or event)
	•	whether the stream is absolute
	•	whether it is compass-backed
	•	sample rate
	•	last sample age
	•	screen angle
	•	reported compass heading
	•	reported compass accuracy
	•	whether calibration is active
	•	whether the source was upgraded from relative to absolute

This is required for debugging real-device inconsistencies.

20. Permissions Policy

Add this header in Next.js:

Permissions-Policy: accelerometer=(self), gyroscope=(self), magnetometer=(self)

Do not broaden the allowlist.

If the app is ever embedded, require the embedding iframe to specify:

allow="accelerometer; gyroscope; magnetometer"

This matters because Generic Sensor APIs can be blocked by policy.  ￼

21. Tests

21.1 Add tests/unit/orientation.test.ts

Cover these exact mocked runtimes.

iOS Safari runtime
Mock:
	•	DeviceOrientationEvent.requestPermission exists
	•	DeviceMotionEvent.requestPermission exists
	•	no Generic Sensor constructors
	•	event provider emits deviceorientation with finite webkitCompassHeading

Assert:
	•	prompt-only function returns granted/denied correctly
	•	startup still uses event provider
	•	compass metadata is preserved
	•	stream stays relative until validation succeeds
	•	after validation, source upgrades to absolute-equivalent
	•	denying permission prevents startup

Chrome Android runtime
Mock:
	•	no static permission methods
	•	AbsoluteOrientationSensor exists
	•	RelativeOrientationSensor exists
	•	event provider exists

Assert:
	•	absolute sensor wins over all others
	•	if absolute sensor fails, relative sensor wins over relative events
	•	plain deviceorientation with absolute !== true is classified as relative
	•	no calibration required for absolute sensor
	•	calibration required for relative sensor/event

Firefox Android runtime
Mock:
	•	no static permission methods
	•	no Generic Sensor constructors
	•	only event provider exists

Assert:
	•	startup succeeds via event path only
	•	event.absolute === true yields absolute event source
	•	otherwise relative event source is selected
	•	calibration required in the relative case

Samsung Internet runtime
Mock like Chrome, but with cases where:
	•	sensor constructors exist but fail on start
	•	event provider succeeds

Assert:
	•	clean fallback from sensor path to event path
	•	re-arbitration works after stall/error

Generic failover
Assert:
	•	selected provider stall triggers re-arbitration
	•	relative source upgrades to absolute within upgrade window
	•	source changes clear smoothing and history
	•	permission prompting is no longer treated as readiness

21.2 Update tests/unit/viewer-shell.test.ts

Update startup tests so they assert:
	•	route orientation stays 'unknown' until the first usable sample
	•	first usable sample flips route orientation to 'granted'
	•	denied prompt still yields denied path
	•	no-provider timeout yields unavailable or denied appropriately
	•	relative source shows calibration-needed UI
	•	absolute source shows aligned/settling UI
	•	Safari validated compass-backed upgrade disables mandatory calibration only after validation

22. Manual verification matrix

Run these on real devices.

iPhone Safari
	•	Start AR from a fresh visit
	•	verify permission prompt appears
	•	deny → blocked state
	•	allow → event provider selected
	•	portrait/landscape keep labels aligned
	•	compass metadata visible in diagnostics
	•	background/foreground app → providers recover
	•	confirm validated compass-backed upgrade behaves correctly

Chrome Android
	•	absolute sensor path selected when available
	•	if compass/magnetometer path is unavailable, relative sensor path selected
	•	if sensor path fails, event path selected
	•	site permission blocked → recovery copy is appropriate
	•	rotation and background/foreground remain stable

Firefox Android
	•	no requestPermission path required
	•	event provider selected
	•	relative path still works and prompts alignment
	•	no dead startup when no absolute path appears

Samsung Internet
	•	same cases as Chrome
	•	confirm Generic Sensor support on at least one Galaxy device
	•	confirm event fallback on a version/device combination where sensor support differs

23. Acceptance criteria

The implementation is complete only when all of these are true:
	1.	iOS Safari still works through the user-gesture permission flow.
	2.	Chrome Android prefers absolute sensor, then relative sensor, then event fallback.
	3.	Firefox Android works without depending on static requestPermission().
	4.	Samsung Internet follows the same ladder as Chrome and falls back cleanly.
	5.	Relative sources always require calibration before trust.
	6.	Absolute sources never require mandatory calibration.
	7.	Safari compass-backed events only disable mandatory calibration after validation.
	8.	Provider stall/error triggers re-arbitration instead of freezing pose.
	9.	devicemotion is not used for pose.
	10.	The orientation code compiles cleanly and the updated tests pass.

24. Implementation order

Follow this order exactly:
	1.	update types in orientation.ts
	2.	add supportsRelativeOrientationSensor
	3.	refactor requestOrientationPermission() into prompt-only behavior
	4.	add querySensorPermissionHints()
	5.	improve startAbsoluteOrientationSensorProvider()
	6.	add startRelativeOrientationSensorProvider()
	7.	rewrite startDeviceOrientationProvider()
	8.	refactor raw pose creation for matrix-or-quaternion raw samples
	9.	implement Safari compass validation upgrade
	10.	rewrite provider arbitration inside subscribeToOrientationPose()
	11.	wire the new readiness model into ViewerShell
	12.	add browser-family helper for copy only
	13.	add Permissions-Policy header
	14.	add tests/unit/orientation.test.ts
	15.	update tests/unit/viewer-shell.test.ts
	16.	run the real-device matrix on the four target browsers

This plan is implementation-ready.
