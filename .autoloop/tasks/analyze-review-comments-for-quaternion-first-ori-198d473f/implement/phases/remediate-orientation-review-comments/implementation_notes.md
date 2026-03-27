# Implementation Notes

- Task ID: analyze-review-comments-for-quaternion-first-ori-198d473f
- Pair: implement
- Phase ID: remediate-orientation-review-comments
- Phase Directory Key: remediate-orientation-review-comments
- Phase Title: Remediate quaternion-first orientation review findings
- Scope: phase-local producer artifact

## Files changed
- `lib/sensors/orientation.ts`
- `lib/projection/camera.ts`
- `tests/unit/orientation-foundation.test.ts`
- `tests/unit/orientation-permission-and-subscription.test.ts`

## Symbols touched
- `smoothOrientationSample`
- `orientLandscapeSampleForPoseContract`
- `getQuaternionRollDeg`
- `clamp`
- `normalizeVec3`
- `crossVec3`
- `dotVec3`

## Checklist mapping
- Quaternion smoothing interpolation: completed in `smoothOrientationSample` with quaternion-only slerp and single-sided Euler rebuild fallback.
- Vector utility deduplication: completed by exporting minimal camera helpers and removing local duplicates from orientation math.
- Landscape quaternion/Euler consistency: completed by rebuilding `sample.quaternion` after the landscape pose-contract pitch/roll flip.
- Focused regression tests: completed in orientation foundation/subscription tests; broader camera tests rerun unchanged.

## Assumptions
- The existing continuous Euler pose contract remains authoritative for emitted heading/pitch/roll, including wrapped roll output during smoothing.
- Exporting minimal vector helpers from `lib/projection/camera.ts` does not widen any public API relied on outside current camera/orientation math.

## Preserved invariants
- Zenith, nadir, and repeated landscape continuity behavior remain angle-authoritative.
- The existing landscape `abs(screenOrientationDeg) === 90` and `abs(pitchDeg) <= 90` branch gate is unchanged.
- Viewer-facing `CameraPose`, recenter semantics, permission probing, and stream-selection behavior are unchanged.

## Intended behavior changes
- Smoothed samples now preserve normalized quaternion metadata via slerp when both neighboring quaternions are available.
- Landscape-normalized samples now keep quaternion metadata aligned with the emitted pitch/roll values.

## Known non-changes
- Smoothed quaternion metadata still does not replace the emitted Euler continuity path.
- No new generic math module was introduced.
- No permission, stream, or manual-pan logic was changed.

## Expected side effects
- Orientation math reuses shared camera vector helpers instead of maintaining duplicate local implementations.
- Tests now lock in quaternion normalization and landscape quaternion/Euler agreement.

## Validation performed
- `npm exec -- vitest run tests/unit/orientation-foundation.test.ts tests/unit/orientation-permission-and-subscription.test.ts tests/unit/projection-camera.test.ts`
- `npm test`

## Deduplication / centralization decisions
- Shared `clamp`, `normalizeVec3`, `crossVec3`, and `dotVec3` now live in `lib/projection/camera.ts`; orientation reuses those exports instead of keeping local copies.
