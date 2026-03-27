# Test Strategy

- Task ID: analyze-review-comments-for-quaternion-first-ori-198d473f
- Pair: test
- Phase ID: remediate-orientation-review-comments
- Phase Directory Key: remediate-orientation-review-comments
- Phase Title: Remediate quaternion-first orientation review findings
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-1 quaternion smoothing metadata:
  covered in `tests/unit/orientation-foundation.test.ts`
  `interpolates quaternion metadata without changing continuous euler smoothing` verifies continuous Euler outputs stay on the existing wrapped branch while quaternion metadata matches quaternion slerp and remains normalized.
- AC-1 single-sided quaternion fallback:
  covered in `tests/unit/orientation-foundation.test.ts`
  `rebuilds quaternion metadata from the smoothed euler pose when only one sample has quaternion data` verifies the Euler-derived fallback when only one endpoint supplies quaternion metadata.
- AC-2 landscape quaternion/Euler consistency:
  covered in `tests/unit/orientation-foundation.test.ts`
  the landscape zenith and nadir normalization tests now assert quaternion equivalence with `createCameraQuaternion(headingDeg, pitchDeg, rollDeg)` both with and without prior history.
- AC-4 preserved continuity invariants:
  covered in `tests/unit/orientation-foundation.test.ts` and `tests/unit/orientation-permission-and-subscription.test.ts`
  zenith, nadir, and repeated landscape branch continuity remain locked by the existing continuity tests; subscription tests additionally assert smoothed quaternion normalization for zenith/nadir paths.

## Preserved invariants checked
- Continuous heading/pitch/roll remain authoritative through zenith and nadir transitions.
- The repeated landscape zenith path stays on the same positive pitch branch.
- Landscape normalization with or without prior portrait history yields the same pose branch.
- Quaternion metadata stays normalized when smoothing is active.

## Edge cases
- Both quaternion endpoints present during smoothing.
- Only one quaternion endpoint present during smoothing.
- Landscape zenith and landscape nadir normalization with and without prior history.
- Wrapped roll output remains in the existing emitted representation during smoothing.

## Failure paths
- Missing one-side quaternion metadata falls back to Euler-derived quaternion reconstruction instead of dropping quaternion coverage.
- Quaternion sign ambiguity is neutralized by orientation-equivalence assertions rather than raw component equality.

## Flake risks and stabilization
- No network or wall-clock dependency is introduced.
- Subscription coverage uses the existing deterministic in-memory runtime fixture instead of browser APIs.
- Quaternion comparisons use absolute dot-product similarity to avoid false failures from equivalent `q` / `-q` encodings.

## Validation performed
- `npm exec -- vitest run tests/unit/orientation-foundation.test.ts tests/unit/orientation-permission-and-subscription.test.ts`

## Known gaps
- No additional camera-helper direct tests were added because the shared helper behavior is exercised through the public orientation paths already under test.
