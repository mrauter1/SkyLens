# iOS Safari Orientation / Projection Correlation Investigation

## Problem statement investigated
- Rendered object positions do not correlate well with real-world observation.
- Object positions can invert (left/right swap) when pitch crosses ~90° on iPhone Safari.

## What the current code does

### 1) Sensor normalization path
`normalizeDeviceOrientationReading()` builds heading/pitch/roll from `DeviceOrientationEvent` as:
- heading = `webkitCompassHeading` (if available) else `alpha`
- pitch = mostly `beta`
- roll = mostly `gamma`
- plus screen-orientation remapping.

See: `lib/sensors/orientation.ts`.

### 2) Camera pose path
`createSensorCameraPose()` maps the sample directly into the camera pose and quaternion:
- yawDeg = heading
- pitchDeg = pitch
- rollDeg = roll

See: `lib/sensors/orientation.ts` + `lib/projection/camera.ts`.

### 3) Astronomical azimuth path
Sky objects use azimuth/elevation produced by `astronomy-engine` (`Horizon(...)`) and projected with `projectWorldPointToScreen()`.

See: `lib/astronomy/celestial.ts`, `lib/astronomy/stars.ts`, and `lib/projection/camera.ts`.

---

## Deep findings (root causes)

## A) North reference mismatch (magnetic vs true north)
On iOS Safari, the code prefers `webkitCompassHeading`. MDN documents it as a non-standard heading relative to north; in practice on iPhone this is magnetic-compass-derived.

Astronomy/object azimuths are geodetic/astronomical azimuths (true-north frame). A magnetic-vs-true declination gap (commonly several degrees, sometimes >10° depending location) causes persistent horizontal misalignment even when pitch logic is perfect.

Impact:
- Global left/right offset that users perceive as “AR drift” or “wrong correlation”.

## B) Treating Euler components as direct camera yaw/pitch/roll is not physically equivalent
The app currently treats `alpha/beta/gamma` as if they were direct camera yaw/pitch/roll. The W3C spec explicitly defines them as intrinsic Tait-Bryan `Z-X'-Y''` components; these are representation parameters, not a stable camera-frame yaw/pitch/roll decomposition for AR projection.

Cross-coupling appears at high tilt. Around near-vertical/overhead postures, small changes in one angle can require large compensating changes in the others. Direct mapping increases nonlinear error and apparent inversion risk.

Impact:
- Bad world-to-screen correlation at nontrivial tilt/roll combinations.
- Behavior differs by browser implementation details.

## C) Expected singularity/ambiguity around 90° (gimbal-lock zone) + branch switching
The W3C spec notes Tait-Bryan disadvantages including gimbal-lock behavior. Near pitch ±90°, equivalent orientations can be represented by different `(alpha,beta,gamma)` triplets with 180° branch changes.

The current continuity logic (`createOrientationContinuityCandidates`) tries to pick between two branches, but it still depends on previous sample continuity and can break when samples are noisy, event-source changes occur, or startup/recenter state resets.

Impact:
- Around crossing 90°, left/right can suddenly invert (heading+roll branch flip) even though physical motion is continuous.

## D) Missing explicit camera/device frame mount calibration
iPhone sensor frame, CSS/screen frame, and rear-camera optical frame are not identical in all postures. Production AR stacks usually include a fixed mount quaternion (device-to-camera transform), plus orientation-to-screen transform.

The current implementation applies simple screen-angle remapping, but not a full device-frame-to-camera-frame calibration term.

Impact:
- Residual systematic rotation/offset even after heading/pitch offsets.
- Worse when pitch/roll are large.

## E) Offset controls cannot compensate structural errors
`viewerSettings.pitchOffsetDeg` is clamped to `[-10, 10]`, so users cannot correct large deterministic bias (e.g., if baseline/interpretation yields ~90° discrepancy). This is useful for small trim only, not for frame-mapping mistakes.

---

## Why inversion is specifically visible beyond 90° on iOS Safari
1. iOS Safari emits orientation in Euler form with non-standard `webkitCompassHeading` addition.
2. Euler representation near zenith/nadir has multiple valid angle encodings.
3. Current pipeline reconstructs pose from decomposed angles (instead of directly consuming a rotation quaternion/matrix), making it sensitive to encoding branch changes.
4. When branch transitions occur, heading/roll can jump by ~180° equivalence and appear as horizontal inversion.

So the behavior is expected from the current math model under iOS sensor conventions.

---

## Recommended remediation (in order)

1. **Stop deriving pose from “heading/pitch/roll” directly.**
   - Build a quaternion from `alpha/beta/gamma` using the W3C rotation model (`Z-X'-Y''`) and screen orientation.
   - Keep quaternion as source of truth end-to-end.

2. **Project using quaternion-only camera basis.**
   - Derive forward/right/up vectors from quaternion, not from reconstructed Euler pitch conventions.

3. **Apply magnetic declination correction (or choose a true-north reference path).**
   - If using `webkitCompassHeading`, convert magnetic heading to true heading using location+time geomagnetic model.
   - Alternatively rely on absolute orientation sensor fusion where true north is available/validated.

4. **Introduce explicit device-to-camera mount quaternion calibration.**
   - One-time per platform/model default + user fine trim.

5. **Improve continuity at singularities.**
   - Do continuity in quaternion space (shortest-arc quaternion interpolation / SLERP), not on Euler triplets.

6. **Collect iPhone trace fixtures around 70°..110° pitch** and add regression tests.
   - Include roll sweeps and screen orientation transitions.

---

## External references used
- W3C Device Orientation and Motion spec (angle model, AR compass example, gimbal-lock note): https://www.w3.org/TR/orientation-event/
- MDN `DeviceOrientationEvent` and `webkitCompassHeading` notes (non-standard, axis ranges):
  - https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
  - https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientationabsolute_event
