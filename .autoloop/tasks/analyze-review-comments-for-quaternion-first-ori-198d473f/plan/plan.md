# Plan

## Scope
- Analyze the three quaternion-first orientation review comments against the current implementation and apply only the fixes that are correct and compatible with the existing sensor pose contract.
- Keep `CameraPose`, permission-state handling, recenter behavior, viewer settings, and stream-selection behavior unchanged; this is a local orientation-math cleanup.

## Review Assessment
- Quaternion smoothing interpolation: Correct and applicable with a constraint. `smoothOrientationSample()` currently smooths heading/pitch/roll continuously, then rebuilds `quaternion` from those angles. That keeps emitted Euler continuity, but it discards the canonical quaternion path and can leave quaternion metadata inconsistent with the quaternion-first normalization intent. The fix should interpolate quaternion metadata directly when both samples have quaternions, without making quaternion slerp the source of truth for emitted Euler continuity.
- Vector utility deduplication: Correct and applicable. `lib/sensors/orientation.ts` currently redefines `clamp`, `normalizeVec3`, `crossVec3`, and `dotVec3` even though equivalent math already exists in `lib/projection/camera.ts`. These helpers are part of the same camera/quaternion math surface and should be shared there instead of duplicated locally.
- Quaternion/Euler consistency in landscape adjustments: Correct and applicable. `orientLandscapeSampleForPoseContract()` currently flips `pitchDeg` and `rollDeg` for the `±90°` screen branch after quaternion extraction, but it leaves `sample.quaternion` untouched. That makes `OrientationSample` internally inconsistent whenever the landscape pose-contract adjustment runs.

## Milestone
### Ship one focused orientation consistency slice
- Keep continuous heading/pitch/roll smoothing as the authoritative emitted pose path so zenith/nadir continuity remains stable.
- Update quaternion metadata handling so `OrientationSample.quaternion` is interpolated from adjacent quaternions when both are present, with a local fallback to quaternion-from-angles only when one side lacks quaternion data.
- Remove duplicated vector helpers from `lib/sensors/orientation.ts` by reusing minimal shared math exported from `lib/projection/camera.ts`.
- Make landscape pose-contract normalization update quaternion and Euler representations together so every emitted `OrientationSample` remains self-consistent.
- Add focused unit coverage for quaternion interpolation behavior, landscape quaternion/Euler agreement, and any newly shared camera math helpers if their exports change.

## Interfaces And Invariants
- `CameraPose` remains `yawDeg`, `pitchDeg`, `rollDeg`, `quaternion`, `alignmentHealth`, and `mode`; no viewer API, route, persisted-state, or permission-contract changes are planned.
- `OrientationSample.headingDeg`, `pitchDeg`, and `rollDeg` remain the authoritative smoothed values consumed by recenter, offsets, and alignment history. Quaternion interpolation must not replace the existing continuous-angle branch-selection logic.
- `OrientationSample.quaternion`, when present, must correspond to the same orientation as the exported heading/pitch/roll fields after landscape normalization and smoothing.
- Shared vector helpers should live in `lib/projection/camera.ts`, where quaternion/basis math already resides. Do not introduce a new generic math module for this small slice.
- Landscape (`±90°`) pose-contract sign selection must continue preserving the existing branch rule: only samples still inside the `[-90°, +90°]` pitch branch are flipped for pose-contract compatibility, while already-continuous `>90°` / `<-90°` samples stay untouched.

## Validation
- Extend `tests/unit/orientation-foundation.test.ts` to cover:
  - quaternion interpolation preserving a normalized quaternion while leaving wrapped-angle smoothing behavior unchanged
  - landscape-adjusted samples keeping quaternion and Euler-derived pose directions aligned
  - repeated landscape normalization remaining history-independent after the consistency fix
- Extend `tests/unit/orientation-permission-and-subscription.test.ts` only where needed to confirm the smoothed subscription stream still preserves zenith/nadir continuity after the quaternion-metadata change.
- Extend `tests/unit/projection-camera.test.ts` only if newly exported shared vector helpers need direct coverage; avoid test churn if orientation tests already cover the behavior through public sensor APIs.
- Final implementation verification should run the targeted orientation tests and then the broader project test command used in this repo.

## Compatibility Notes
- No migration is required.
- No intentional behavior break is planned. The desired outcome is stricter internal consistency of orientation samples and less duplicated math while preserving existing emitted heading/pitch/roll behavior.
- If quaternion interpolation changes any observable pose behavior beyond fixing quaternion metadata consistency, treat that as a regression and revert to angle-authoritative smoothing with only metadata interpolation retained.

## Regression Prevention
- Keep edits concentrated in `lib/sensors/orientation.ts`, with only minimal helper exports added to `lib/projection/camera.ts`.
- Do not change stream selection, permission probing, recenter baseline semantics, or manual-pan pose handling as part of this task.
- Use tests that assert continuity and projection-direction invariants, not just exact angle snapshots, so quaternion/Euler disagreement and mirrored-axis regressions are caught.

## Risk Register
- R1: Direct quaternion slerp can choose the short arc across zenith/nadir and reintroduce flips if it becomes the authority for emitted angles.
  - Control: keep heading/pitch/roll smoothing and branch selection authoritative; limit quaternion interpolation to optional quaternion metadata.
- R2: Sharing vector helpers can accidentally widen the public math surface or create circular dependencies.
  - Control: export only the small helpers already implied by camera math from `lib/projection/camera.ts`; do not add a new module or move angle utilities.
- R3: Fixing landscape quaternion consistency can accidentally alter the established `±90°` pitch-branch behavior.
  - Control: preserve the current branch gate and add tests that compare the same landscape reading with and without prior history.

## Rollback
- Revert quaternion interpolation changes if they alter emitted sensor heading/pitch/roll continuity instead of only fixing quaternion metadata quality.
- Revert the shared-helper export if it creates dependency churn outside orientation/camera math; do not replace it with a new generic utility layer.
- Revert the landscape consistency adjustment only if it changes the established landscape branch-selection contract rather than keeping quaternion and Euler representations aligned.
