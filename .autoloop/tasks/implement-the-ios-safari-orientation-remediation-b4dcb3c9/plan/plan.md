# Plan

## Scope
- Implement the iOS Safari orientation remediation inside the sensor normalization and pose-math path, not as a viewer-shell redesign.
- Replace the current Euler-first normalization with a quaternion-first pipeline while preserving the existing `CameraPose`, permission-state, settings-storage, and recenter contracts.
- Add regression coverage for the Safari failure modes called out in the request: inversion past 90 degrees, degraded real-world alignment, and screen-orientation handling.

## Current Baseline
- `lib/sensors/orientation.ts` currently remaps raw `alpha` / `beta` / `gamma` into heading, pitch, and roll per screen angle, then creates a quaternion afterward.
- `subscribeToOrientationPose()` already owns stream selection, smoothing, alignment history, offsets, and recentering; `components/viewer/viewer-shell.tsx` only consumes the normalized pose contract and should stay largely untouched.
- `lib/projection/camera.ts` already owns quaternion math and projection invariants, so any shared quaternion helper added for this remediation should live there instead of duplicating math inside the sensor module.

## Milestone
### Ship one focused quaternion-first orientation slice
- Normalize raw device-orientation readings into the app's camera quaternion first:
  - convert browser/device axes into the existing ENU camera convention
  - compose screen-orientation correction in quaternion space instead of rotating raw Euler fields
  - preserve Safari heading behavior by honoring `webkitCompassHeading` when it is the most trustworthy heading source
- Derive continuous yaw, pitch, and roll from the stabilized quaternion or derived basis vectors so pitch can cross above `+90` and below `-90` without the current heading/roll inversion.
- Keep smoothing, recenter, heading/pitch offsets, alignment health, and `CameraPose` emission behavior intact, but make them operate on quaternion-derived sensor state instead of screen-angle-remapped Euler angles.
- Add targeted regression coverage for portrait/landscape correction, >90-degree continuity, recenter stability near zenith/nadir, and projection/alignment invariants that reflect real-world pointing.

## Interfaces And Invariants
- `CameraPose` remains `yawDeg`, `pitchDeg`, `rollDeg`, `quaternion`, `alignmentHealth`, and `mode`; no route, query-param, storage-schema, or permission-enum changes are planned.
- `subscribeToOrientationPose()` must stay source-compatible for existing consumers. If `OrientationSample` gains quaternion metadata internally, the existing `headingDeg`, `pitchDeg`, `rollDeg`, and `timestampMs` fields must remain available and continuous.
- `createSensorCameraPose()` must continue applying recenter baseline and persisted heading/pitch offsets after smoothing. Recenter must not wipe user offsets.
- Positive yaw/heading must continue to mean clockwise azimuth from north in world space, eastward objects must remain on the right side of the viewport, and screen-rotation correction must not mirror the camera basis.
- Existing `deviceorientationabsolute` preference, `deviceorientation` fallback, and permission-probing semantics stay unchanged unless a local adjustment is strictly required by the quaternion remediation.

## Validation
- Extend `tests/unit/orientation-foundation.test.ts` to cover:
  - quaternion-backed screen-orientation correction in portrait and landscape
  - no yaw/roll inversion when pitch crosses above `+90` and below `-90`
  - pose continuity and recenter stability near zenith and nadir
  - Safari heading precedence when `webkitCompassHeading` and `alpha` disagree
- Extend `tests/unit/orientation-permission-and-subscription.test.ts` so emitted samples and poses remain continuous and correctly aligned through Safari-style >90-degree transitions after smoothing and baseline handling.
- Add or extend `tests/unit/projection-camera.test.ts` only if the remediation introduces small shared quaternion helpers in `lib/projection/camera.ts`; use projection invariants to catch mirrored-axis regressions.
- Require explicit manual iPhone Safari smoke validation before closeout because this task targets real sensor alignment:
  - verify portrait and landscape pointing against known north/east references after screen rotation
  - verify pitch transitions through `+90` and `-90` do not invert heading/roll
  - verify recenter and persisted heading/pitch offsets still behave correctly on device
- If a physical iPhone Safari validation path is unavailable in the implementation environment, record that as an explicit unresolved validation gap instead of treating unit tests alone as sufficient proof of real-world alignment.
- Final implementation verification should run `npm run test`. `npm run lint` is also warranted if exported math helpers or types change.

## Compatibility Notes
- No migration is required for persisted viewer settings.
- No viewer route-state, permission, or manual-pan fallback behavior changes are intended.
- The only intentional behavior change is corrected live sensor pose math on iOS Safari and any other browser affected by the same >90-degree singularity or alignment drift.
- Rollout should remain effectively gated on the Safari smoke check above; do not declare the remediation fully validated without either passing that check or explicitly carrying the remaining device-validation gap forward.

## Regression Prevention
- Keep edits concentrated in `lib/sensors/orientation.ts`, with only minimal shared quaternion helpers added to `lib/projection/camera.ts` if needed.
- Preserve the current one-stream orientation subscription behavior; do not reopen mixed-stream history as part of this remediation.
- Use world/projection invariants in tests, not only angle snapshots, so mirrored or rotated-camera regressions are detected.

## Risk Register
- R1: A browser-to-ENU quaternion conversion mistake can introduce a constant yaw error or mirrored axes.
  - Control: add explicit north/east/up projection expectations for representative portrait and landscape readings.
- R2: Recenter or smoothing can regress if baseline subtraction stays Euler-based while normalized samples become quaternion-based.
  - Control: keep baseline and smoothing aligned with the new canonical quaternion state and retain explicit zenith/nadir recenter tests.
- R3: Safari heading data can conflict with relative `alpha` values and accidentally degrade alignment on non-Safari paths.
  - Control: keep `webkitCompassHeading` precedence explicit and cover both heading-source paths in unit tests.
- R4: Shared quaternion helpers can drift from the existing camera projection math if duplicated.
  - Control: reuse or minimally extend `lib/projection/camera.ts` rather than creating parallel quaternion utilities in the sensor layer.

## Rollback
- Revert the quaternion-first normalization and pose-derivation slice independently if tests or manual device checks show global misalignment, while leaving permission probing and stream selection intact.
- Revert newly added shared quaternion helpers only if they destabilize projection behavior outside the sensor pipeline; do not replace them with duplicated local math as a fallback.
