# Improve Orientation/Motion Refactor Plan

## Scope
- Limit code changes to `SkyLensServerless/`.
- Implement the provider ladder, Safari compass validation, prompt-only permission flow, viewer readiness changes, and test coverage described in `SkyLensServerless/ImproveOrientarionAndMotion.md`.
- Include the shipped permission-policy/embed contract and its validation surfaces where they currently encode the old broader allowlist: `next.config.ts`, `public/_headers`, `app/embed-validation/page.tsx`, and the related unit/e2e tests under `SkyLensServerless/tests/`.
- Preserve existing non-goals: no `devicemotion` pose fallback, no UA-based provider selection, no manual-pan rewrite, no camera math rewrite beyond local helpers needed for quaternion/screen-frame handling.

## Milestones
1. Orientation runtime refactor in `lib/sensors/orientation.ts`
- Extend public types exactly as specified: add `'relative-sensor'`, keep coarse public source labels, add compass metadata fields, add sensor/permission capability types, and allow both matrix-backed and quaternion-backed raw samples.
- Refactor `requestOrientationPermission(runtime?)` into a prompt-only function. Readiness must come from providers emitting usable samples, not from permission probes.
- Add capability helpers and `querySensorPermissionHints(runtime)` so Generic Sensor startup is skipped only on explicit denied hints, never on unsupported/failed queries.
- Rewrite provider starters to cover absolute sensor, relative sensor, and dual-event listeners; classify event samples by event type/`absolute` flag; preserve Safari compass metadata without treating it as absolute up front.
- Rewrite `subscribeToOrientationPose()` into a coordinator that starts all plausible providers, arbitrates by configured priority, supports late absolute upgrades, validates Safari compass-backed upgrades, restarts on stall/error, preserves calibration across restarts, and clears smoothing/history on source changes or provider upgrades.
- Add lifecycle and rotation handling to that coordinator: stop providers on `document.visibilitychange` to hidden and `pagehide`, restart arbitration on visible and `pageshow`, recompute event-provider screen correction on rotation changes, and keep screen-frame sensor providers exempt from extra correction.

2. Viewer/runtime integration in `components/viewer/viewer-shell.tsx`
- Change startup flow so `Start AR` performs prompt-first behavior, but route/UI orientation stays `unknown` until the first usable `OrientationSample` arrives.
- Preserve the denied path when explicit prompt APIs deny, and distinguish no-provider startup failures between `unavailable` (no APIs) and `denied` (APIs present but no usable provider after user action).
- Update motion/status labels to expose absolute sensor, absolute event, relative sensor, relative event, and manual states instead of flattening them.
- Add browser-family recovery copy for help text only; provider selection remains feature/sample driven.
- Add development-only diagnostics for provider kind, absoluteness, compass metadata, sample age/rate, screen angle, calibration state, and upgrade status.

3. Compatibility/config/test completion
- Align `next.config.ts`, `public/_headers`, and embed guidance with the source spec’s sensor-only contract: `Permissions-Policy: accelerometer=(self), gyroscope=(self), magnetometer=(self)` and iframe `allow="accelerometer; gyroscope; magnetometer"`.
- Update `app/embed-validation/page.tsx` and the affected validation tests so shipped copy/assertions no longer expect camera/geolocation in that contract.
- Add `tests/unit/orientation.test.ts` for runtime/provider coverage across iOS Safari, Chrome Android, Firefox Android, Samsung Internet, and generic failover scenarios.
- Update `tests/unit/viewer-shell.test.ts` so startup/readiness assertions follow the new prompt-vs-ready split and the new calibration/upgrade UX.
- Keep or trim older orientation unit coverage only as needed to avoid duplication while preserving math/foundation coverage already in `orientation-foundation.test.ts` and any config/embed tests that verify the narrowed policy contract.

## Interfaces And Behaviors
- `OrientationSource` must become: `'absolute-sensor' | 'relative-sensor' | 'deviceorientation-absolute' | 'deviceorientation-relative' | 'manual'`.
- `RawOrientationSample` must carry `providerKind`, `absolute`, `localFrame`, `timestampMs`, optional `worldFromLocal`, optional `rawQuaternion`, and optional Safari compass metadata.
- `OrientationSample` must expose propagated compass metadata and preserve `needsCalibration = !rawSample.absolute && !calibration.calibrated`.
- `OrientationRuntime` must allow `RelativeOrientationSensor` and `permissions.query`.
- `subscribeToOrientationPose()` should keep its controller role (`recenter`, `setCalibration`, `stop`) while internally coordinating multiple providers and lifecycle restart behavior.
- Sensor providers created with `referenceFrame: 'screen'` must not receive extra screen correction; device-frame event quaternions must.

## Compatibility Notes
- iOS Safari: preserve user-gesture permission prompts and event-driven pose flow; only disable mandatory calibration after compass validation succeeds.
- Chrome for Android / Samsung Internet: prefer `AbsoluteOrientationSensor`, then `deviceorientationabsolute` or `event.absolute === true`, then `RelativeOrientationSensor`, then relative events.
- Firefox for Android: never require static `requestPermission()` methods; event-only startup must still work.
- Permissions-policy compatibility intentionally narrows the current public/embed contract from camera+geolocation+motion to the spec’s sensor-only allowlist; update the embed-validation page and its tests in the same slice so shipped docs/copy never advertise the stale broader contract.

## Regression Controls
- Preserve calibration state across provider restarts and failover; only clear smoothing/history when the active source changes or a relative stream upgrades/downgrades.
- Treat compass-backed Safari events as relative until validation passes; avoid false absolute trust from `webkitCompassHeading` alone.
- Keep screen-angle correction single-applied: event/device-frame inputs need correction, screen-frame sensor inputs do not.
- Treat background/foreground transitions as a first-class regression surface: hidden/pagehide must stop active providers cleanly, visible/pageshow must re-arbitrate, and rotation updates must not freeze or double-correct pose.
- Keep route/UI state aligned with real readiness: prompt success alone must not mark orientation ready.
- Fail startup conservatively: if no provider emits after user action, surface manual fallback and accurate route permission state instead of leaving a silent pending state.

## Risk Register
- Safari regression risk: prompt flow or validated upgrade could break current working behavior.
  Control: preserve event path, add Safari-specific unit coverage, and require consecutive validation samples before removing calibration.
- Android compatibility risk: sensor constructors may exist but fail or stall.
  Control: use hint-based startup suppression only for explicit denied permissions, start all plausible providers, and re-arbitrate on error/stall.
- Lifecycle recovery risk: mobile browsers may suspend or invalidate providers on background/foreground transitions.
  Control: make visibility/page lifecycle restart behavior explicit in the coordinator scope and cover it in mocked failover tests plus device-matrix validation.
- Math/orientation risk: quaternion-path refactor could double-apply screen correction or mis-handle screen/device local frames.
  Control: retain current basis-derived path, add dedicated quaternion/screen-angle tests, and keep sensor `referenceFrame: 'screen'` exempt from extra correction.
- Viewer UX regression risk: route permission state and badges may drift from the new readiness model.
  Control: update startup tests to assert `unknown` until first usable sample, then assert exact transitions for granted/denied/unavailable/relative states.
- Public contract drift risk: config headers may change while embed-validation copy/tests still describe the old camera/geolocation delegation contract.
  Control: treat header/config, embed-validation route copy, iframe `allow`, and matching test expectations as one compatibility surface and update them together.
- Technical-debt risk: splitting logic across ad hoc helpers or duplicated browser branches.
  Control: keep provider selection centralized in `orientation.ts`, use browser-family detection only for copy, and reuse existing viewer state/update helpers where possible.

## Validation
- Unit/integration: run the updated orientation and viewer-shell tests plus the config/embed validation tests affected by the narrowed sensor-only permissions-policy and iframe allow contract, including any `embed.spec.ts`, `permissions.spec.ts`, or serve-export coverage that encodes those headers or labels.
- Manual/device matrix: execute the four-browser matrix from the source spec after code is complete.
- Rollback: revert to manual fallback behavior by disabling the new coordinator changes in `orientation.ts` and viewer startup gating if a browser-specific regression is discovered during validation.
