# Test Strategy

- Task ID: implement-the-ios-safari-orientation-remediation-b4dcb3c9
- Pair: test
- Phase ID: remediate-ios-safari-orientation
- Phase Directory Key: remediate-ios-safari-orientation
- Phase Title: Remediate the iOS Safari orientation pipeline
- Scope: phase-local producer artifact

## Behavior-to-test coverage
- Quaternion-first screen correction and projection invariants:
  - `tests/unit/orientation-foundation.test.ts`
  - Covers east/west projection ordering after `90°` screen correction and preserves the viewer pose contract through `createSensorCameraPose()`.
- Safari heading precedence and preserved subscription behavior:
  - `tests/unit/orientation-foundation.test.ts`
  - `tests/unit/orientation-permission-and-subscription.test.ts`
  - Covers `webkitCompassHeading` precedence plus unchanged `deviceorientationabsolute`/`deviceorientation` stream-selection behavior.
- >90° continuity and recenter stability:
  - `tests/unit/orientation-foundation.test.ts`
  - `tests/unit/orientation-permission-and-subscription.test.ts`
  - Covers zenith and nadir continuity, emitted-sample continuity after smoothing, and recenter stability when the baseline is captured near zenith.
- History-independent `±90°` landscape branch selection:
  - `tests/unit/orientation-foundation.test.ts`
  - Covers the same zenith and nadir landscape quaternions both as first samples and after prior portrait-history samples to ensure identical normalized heading/pitch/roll output.
- Same-branch subscription behavior under smoothing:
  - `tests/unit/orientation-permission-and-subscription.test.ts`
  - Covers repeated near-zenith landscape samples staying on the positive pitch branch after smoothing instead of flipping because a prior sample exists.

## Preserved invariants checked
- `CameraPose`, offsets, recenter API, and permission/stream-selection behavior stay source-compatible.
- Landscape remediation must not mirror east/west world projection ordering.
- `rollDeg` remains near zero through the locked zenith/nadir landscape regressions.

## Edge cases and failure paths
- Missing alpha/beta/gamma continues to return `null` through the existing probe/subscription tests.
- Both positive and negative near-vertical landscape branches are now covered directly for history sensitivity.

## Stabilization approach
- Tests use deterministic synthetic orientation samples and the existing fake-timer harness for subscription timing.
- No network or device dependencies are introduced; the remaining real iPhone Safari smoke check stays an explicit gap outside unit coverage.

## Known gaps
- Real-device iPhone Safari smoke validation is still required for portrait/landscape pointing alignment, >90° transitions, and recenter/offset behavior.
