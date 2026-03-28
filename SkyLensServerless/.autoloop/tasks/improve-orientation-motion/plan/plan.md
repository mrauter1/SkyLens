# Improve Orientation And Motion Compatibility

## Scope
- In scope: `/workspace/SkyLens/SkyLensServerless/lib/sensors/orientation.ts`, `/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx`, `/workspace/SkyLens/SkyLensServerless/tests/unit/orientation.test.ts`, `/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell.test.ts`, and `/workspace/SkyLens/SkyLensServerless/next.config.ts` only if header verification requires a code change.
- Out of scope: devicemotion pose fallback, manual-pan rewrite, UA-driven provider selection, projection math changes beyond a strictly local helper, and unrelated viewer/runtime cleanup.

## Current State
- `orientation.ts` only coordinates `AbsoluteOrientationSensor` plus combined `deviceorientation` listeners, and `requestOrientationPermission()` still conflates prompting with provider readiness through event/sensor probes.
- `viewer-shell.tsx` treats prompt success as motion readiness by persisting route orientation too early, and it only surfaces coarse sensor labels derived from `orientationAbsolute` and `orientationSource`.
- `/workspace/SkyLens/SkyLensServerless/tests/unit/orientation.test.ts` does not exist yet; `/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell.test.ts` covers startup gating but not provider readiness timing, provider failure classification, or Safari validation upgrade behavior.
- `/workspace/SkyLens/SkyLensServerless/next.config.ts` already emits the narrow `Permissions-Policy` allowlist required by the task; implementation should preserve this unless verification finds drift.

## Milestones
### 1. Orientation Runtime Refactor
- Update public/internal types in `orientation.ts` exactly per the spec: add `relative-sensor`, extend runtime types, replace `RawOrientationSample`, extend `OrientationSample`, and add capability, permission-hint, and provider-controller types/constants.
- Refactor permission handling into prompt-only `requestOrientationPermission()` plus `getOrientationCapabilities()` and `querySensorPermissionHints()`, with no readiness probing and no dependency on static permission methods where unsupported.
- Implement three provider paths under one coordinator: improved absolute sensor, new relative sensor, and rewritten event provider that classifies absolute vs relative correctly while carrying Safari compass metadata as validation input rather than immediate absoluteness.
- Refactor raw pose creation to accept matrix-backed and quaternion-backed samples without double-applying screen correction, then layer Safari compass validation, provider prioritization, upgrade windows, stall/error re-arbitration, and document/page lifecycle restarts into `subscribeToOrientationPose()`.

### 2. Viewer Integration And Verification
- Rewire `viewer-shell.tsx` so motion prompting and motion readiness are separate: prompt result controls denial/unavailability handling, first usable sample flips route orientation to `granted`, and startup timeout/failure maps to `unavailable` vs `denied` from actual capabilities/provider output.
- Replace coarse motion labels/recovery copy with provider-specific labels and copy-only browser-family messaging, while preserving existing live/manual/non-camera UX and calibration flows.
- Keep persisted settings compatible by allowing `relative-sensor` anywhere `PoseCalibration.sourceAtCalibration` is serialized/parsed, and preserve the existing public `OrientationSource` surface without introducing a public compass-only enum.
- Add `tests/unit/orientation.test.ts`, extend `tests/unit/viewer-shell.test.ts`, and verify the existing permissions-policy header behavior. Manual device-matrix validation remains a follow-up validation requirement outside this repository-only environment.

## Interfaces And Compatibility Notes
- `OrientationSource` becomes: `absolute-sensor | relative-sensor | deviceorientation-absolute | deviceorientation-relative | manual`. No public `deviceorientation-compass` value is allowed.
- `RawOrientationSample` must carry `providerKind`, `absolute`, `timestampMs`, `localFrame`, optional `worldFromLocal`, optional `rawQuaternion`, and optional compass metadata so downstream logic can distinguish provider selection from pose math.
- `OrientationSample` must expose `reportedCompassHeadingDeg`, `compassAccuracyDeg`, and `compassBacked` so diagnostics/UI/tests can observe Safari validation state without changing pose math contracts.
- `requestOrientationPermission()` becomes prompt-only. Provider readiness, startup success, timeout classification, upgrade/downgrade, and stall recovery all move into the runtime coordinator.
- `viewer-shell.tsx` must keep route `orientation` at `unknown` after a `granted` or `unavailable` prompt response until the first usable sample arrives; only that sample may flip the route state to `granted`.
- Persisted settings/schema must accept `relative-sensor` in `PoseCalibration.sourceAtCalibration` to avoid rejecting calibration state created from the new relative sensor provider.
- `next.config.ts` should continue to emit only `accelerometer=(self), gyroscope=(self), magnetometer=(self)` for sensor permissions. Do not broaden the allowlist.

## Regression Risks And Controls
- iOS Safari regression risk: treating `webkitCompassHeading` as absolute too early would skip required calibration. Control: keep event samples relative until the validation buffer upgrades them, and add explicit Safari unit coverage.
- Android regression risk: double-applying screen correction or preferring stale event streams over sensors would rotate pose incorrectly. Control: separate `screen` vs `device` local-frame handling and encode provider priorities/upgrade thresholds in tests.
- Readiness regression risk: prompt success without live samples could falsely mark orientation as ready. Control: viewer route state changes only on the first usable sample, with explicit timeout/failure tests.
- Failover regression risk: provider stalls or constructor/start failures could freeze pose. Control: selected-provider stall detection, full coordinator restart, and Samsung/Generic failover tests.
- Persistence regression risk: saved calibration created from `relative-sensor` could be dropped on read. Control: update schema normalization together with orientation type changes.

## Validation
- Automated: `tests/unit/orientation.test.ts` must cover the iOS Safari, Chrome Android, Firefox Android, Samsung Internet, and generic stall/upgrade cases described in the source task.
- Automated: `tests/unit/viewer-shell.test.ts` must cover unknown-to-granted route transitions, denied prompt handling, no-provider timeout classification, relative calibration UI, absolute UI, and Safari validated-upgrade behavior.
- Automated: run the relevant unit suite after implementation and confirm the permissions-policy header behavior remains compliant.
- Manual follow-up: real-device validation on iPhone Safari, Chrome Android, Firefox Android, and Samsung Internet should use the new diagnostics output to confirm provider choice, calibration behavior, rotation handling, and background/foreground recovery.
