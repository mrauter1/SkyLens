# Implementation Notes

- Task ID: implement-the-ios-safari-orientation-remediation-b4dcb3c9
- Pair: implement
- Phase ID: remediate-ios-safari-orientation
- Phase Directory Key: remediate-ios-safari-orientation
- Phase Title: Remediate the iOS Safari orientation pipeline
- Scope: phase-local producer artifact

## Files changed
- `lib/sensors/orientation.ts`
- `tests/unit/orientation-foundation.test.ts`
- `tests/unit/orientation-permission-and-subscription.test.ts`

## Symbols touched
- `normalizeDeviceOrientationReading`
- `createOrientationSampleFromQuaternion`
- `orientLandscapeSampleForPoseContract`

## Checklist mapping
- Quaternion-first normalization: preserved in `normalizeDeviceOrientationReading`; this turn fixed the history-independent landscape sample representation inside quaternion extraction.
- >90 continuity and recenter preservation: completed by applying the landscape pose-contract sign selection after continuity resolution so zenith/nadir transitions stay on the expected branch.
- Shared quaternion helper reuse: no additional helper changes were required in this turn.
- Regression coverage: expanded in orientation foundation and subscription unit suites for same-quaternion consistency and same-branch landscape continuity.
- Manual iPhone Safari smoke validation: not performed in this environment; explicit validation gap remains.

## Assumptions
- The existing viewer pose contract remains the source of truth, so screen-orientation remediation is expressed as a quaternion correction in that camera basis rather than a broader viewer-shell redesign.

## Preserved invariants
- `CameraPose`, permission probing, stream selection, recenter API, offsets, and manual pose contracts remain unchanged.
- Quaternion normalization and east/right projection invariants remain enforced by tests.

## Intended behavior changes
- Landscape (`±90°`) normalized samples no longer depend on whether a previous sample exists.
- The landscape pitch/roll pose-contract representation is chosen after continuity resolution, so equivalent quaternions emit the same near-zenith/nadir branch without re-inverting >90° samples.

## Known non-changes
- No viewer-shell UX, route/query, persisted settings, or manual-pan fallback changes.
- No physical-device Safari smoke check was possible from this environment.

## Expected side effects
- Landscape subscription smoothing now stays on the same positive/negative pitch branch when equivalent near-zenith samples repeat across history boundaries.

## Validation performed
- `npx vitest run tests/unit/orientation-foundation.test.ts tests/unit/orientation-permission-and-subscription.test.ts`
- `npm test`

## Deduplication / centralization
- Landscape pose-contract sign selection is centralized in `orientLandscapeSampleForPoseContract()` instead of branching on first-sample history inside `normalizeDeviceOrientationReading()`.
