# Implementation Notes

- Task ID: improve-orientation-motion-serverless
- Pair: implement
- Phase ID: orientation-runtime-coordinator
- Phase Directory Key: orientation-runtime-coordinator
- Phase Title: Refactor Orientation Runtime And Provider Arbitration
- Scope: phase-local producer artifact

## Files Changed
- `SkyLensServerless/lib/sensors/orientation.ts`
- `SkyLensServerless/tests/unit/orientation.test.ts`
- `SkyLensServerless/tests/unit/orientation-foundation.test.ts`
- `SkyLensServerless/tests/unit/orientation-permission-and-subscription.test.ts` (removed in favor of the consolidated coordinator suite)
- `SkyLensServerless/lib/viewer/settings.ts`

## Symbols Touched
- `OrientationSource`
- `DeviceOrientationReading`
- `RawOrientationSample`
- `OrientationSample`
- `OrientationRuntime`
- `supportsRelativeOrientationSensor()`
- `getOrientationCapabilities()`
- `requestOrientationPermission()`
- `querySensorPermissionHints()`
- `applyScreenCorrectionToQuaternion()`
- `startAbsoluteOrientationSensorProvider()`
- `startRelativeOrientationSensorProvider()`
- `startDeviceOrientationProvider()`
- `subscribeToOrientationPose()`
- internal event-provider ladder identities / arbitration ordering

## Checklist Mapping
- Plan 1.1: extended orientation public/internal types and raw sample shape.
- Plan 1.2: made `requestOrientationPermission()` prompt-only.
- Plan 1.3: added capability helpers and Permissions API sensor hints.
- Plan 1.4: added relative sensor support, dual event classification, compass metadata, and quaternion-backed sensor reads.
- Plan 1.5: rewrote provider arbitration for startup selection, late absolute upgrades, Safari compass validation, stall/error restart, and calibration-preserving restarts.
- Plan 1.6: added hidden/pagehide suspend, visible/pageshow restart, and event-provider orientation-change reprocessing.

## Assumptions
- “Sustained” Safari compass validation failure is implemented as 3 consecutive bad compass-backed samples to mirror the validation sample count.
- Existing public `deviceorientation-absolute` / `deviceorientation-relative` labels remain the only event-facing source labels for Safari validation upgrades/downgrades.
- Permission hints are advisory at startup; slow Permissions API responses must not outrun the 500 ms provider-selection window.

## Preserved Invariants
- Relative providers still require calibration until the raw sample is upgraded to absolute.
- Screen-frame sensors are not double-corrected for screen orientation.
- Calibration state is preserved across provider restarts and arbitration resets.
- No `devicemotion` pose source or UA-based provider selection was introduced.

## Intended Behavior Changes
- Generic Sensor startup now supports both absolute and relative sensors and suppresses sensor construction only on explicit denied permission hints.
- Event classification respects `deviceorientationabsolute`, `event.absolute`, and Safari compass metadata without trusting compass-backed events as absolute before validation.
- Provider arbitration now keeps internal ladder identities for the distinct event rungs, selects after a 500 ms buffer window, upgrades late absolutes, and restarts after lifecycle suspend or stalls.
- Sensor permission hints are time-boxed so explicit denied states can suppress startup without delaying otherwise working absolute/relative sensors past arbitration.

## Known Non-Changes
- Viewer-shell prompt/readiness UX was not changed in this phase.
- Manual pan flow and camera math outside the orientation runtime were not redesigned.

## Expected Side Effects
- Persisted calibration metadata can now round-trip `relative-sensor` as a calibration source.
- Orientation tests move from probe-based readiness expectations to mocked provider-coordinator behavior.

## Validation Performed
- Standalone TypeScript compile passed for `lib/projection/camera.ts`, `lib/viewer/contracts.ts`, and `lib/sensors/orientation.ts` via:
  `npx tsc --noEmit --strict --target ES2020 --module esnext --lib dom,dom.iterable,esnext lib/projection/camera.ts lib/viewer/contracts.ts lib/sensors/orientation.ts`
- Full project `npx tsc --noEmit` was not actionable in this container because workspace dependencies/types are not installed.
- `npm test -- --runInBand tests/unit/orientation-foundation.test.ts` was not runnable because `vitest` is not installed in the container (`sh: 1: vitest: not found`).

## Deduplication / Centralization
- Sensor startup and teardown are centralized in `startOrientationSensorProvider()`.
- Startup selection, internal provider-ladder ordering, upgrade windows, stall handling, and lifecycle restart logic are centralized inside `subscribeToOrientationPose()`.
