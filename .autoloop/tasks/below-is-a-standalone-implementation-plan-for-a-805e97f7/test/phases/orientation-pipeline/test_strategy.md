# Test Strategy

- Task ID: below-is-a-standalone-implementation-plan-for-a-805e97f7
- Pair: test
- Phase ID: orientation-pipeline
- Phase Directory Key: orientation-pipeline
- Phase Title: Raw Orientation And Calibration Pipeline
- Scope: phase-local producer artifact

## Behavior-To-Test Coverage

- AC-1 provider truth:
  - `tests/unit/orientation-permission-and-subscription.test.ts`
  - Covers `event.absolute` overriding event-name assumptions.
  - Covers `webkitCompassHeading` being ignored via `tests/unit/orientation-foundation.test.ts`.
  - Covers `AbsoluteOrientationSensor` winning when it emits a screen-frame reading.
  - Covers fallback to a buffered absolute `deviceorientation` sample when the sensor provider stays pending.
- AC-2 screen-angle invariance:
  - `tests/unit/orientation-foundation.test.ts`
  - Covers W3C upright north/west vectors.
  - Covers the W3C landscape example matching the equivalent upright forward vector.
  - Covers portrait/landscape `screen.orientation.angle` preservation for a fixed physical pose.
- AC-3 calibration gating:
  - `tests/unit/orientation-foundation.test.ts`
  - Covers relative raw samples remaining unaligned until a calibration quaternion is applied.
  - `tests/unit/orientation-permission-and-subscription.test.ts`
  - Covers live subscription state staying `needsCalibration=true` until `recenter()` applies quaternion calibration, then returning to the neutral forward basis.
- AC-4 permission-helper contract:
  - `tests/unit/orientation-permission-and-subscription.test.ts`
  - Covers `DeviceOrientationEvent.requestPermission(true)` and `DeviceMotionEvent.requestPermission()` in the same activation path.
  - Covers explicit motion denial.
  - Covers live event-probe success on platforms without permission APIs.
  - Covers probe timeout returning `unavailable`.
  - Covers sensor-only permission success when `AbsoluteOrientationSensor` is available without orientation events.
  - Covers sensor-only permission timeout returning `unavailable` when `AbsoluteOrientationSensor` never produces a reading.
  - Covers fallback from a silent `deviceorientation*` probe to a later `AbsoluteOrientationSensor` probe so permission gating matches provider startup on mixed-support browsers.

## Preserved Invariants Checked

- Manual drag mode still returns normalized manual poses and allows pitch beyond zenith without a hard clamp.
- Quaternion-derived forward vectors remain the rendering truth for calibration assertions instead of depending on legacy Euler values.
- Provider selection remains deterministic under fake-timer control.

## Edge Cases And Failure Paths

- No usable orientation event before probe timeout.
- No usable `AbsoluteOrientationSensor` reading before probe timeout on a sensor-only runtime.
- Sensor provider present but still pending while absolute and relative device samples arrive.
- Relative stream recalibration emitting a fresh aligned pose without stale smoothing history.

## Flake Risk And Stabilization

- Permission-probe tests wait two microtasks before emitting events so both permission awaits have settled before listeners are exercised.
- Mixed event/sensor permission fallback is stabilized with fake timers by advancing exactly one probe window before triggering the sensor mock reading, so the test exercises the post-timeout sensor path without wall-clock delay.
- Provider-selection timeout tests use fake timers and synchronous mock emitters; no wall-clock waiting or browser APIs are involved.

## Known Gaps

- No real-device/browser integration coverage in this phase; mobile Safari/Android verification remains deferred to later QA phases.
- Startup-controller UI and manual-observer fallback are intentionally out of scope for this phase.
