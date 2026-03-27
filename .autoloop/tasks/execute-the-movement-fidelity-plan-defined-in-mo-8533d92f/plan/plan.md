# Movement Fidelity Implementation Plan

## Scope
Execute the four plan→implement→test pairs in [MOVEMENT_FIDELITY_AUTOLOOP_PLAN.md](/workspace/SkyLens/MOVEMENT_FIDELITY_AUTOLOOP_PLAN.md) end-to-end, then finish repo verification with `npm run test` and `npm run lint`, commit the resulting changes, and create a PR.

## Current Baseline
- [viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) advances `sceneTimeMs` at 1Hz via `setInterval`, rebuilds the scene directly from the latest aircraft/satellite inputs, and records only a selected-object trail capped at 10 samples.
- [settings.ts](/workspace/SkyLens/lib/viewer/settings.ts) persists viewer settings under `skylens.viewer-settings.v1` with no motion-quality control.
- Current unit coverage is concentrated in [viewer-shell.test.ts](/workspace/SkyLens/tests/unit/viewer-shell.test.ts), [viewer-shell-celestial.test.ts](/workspace/SkyLens/tests/unit/viewer-shell-celestial.test.ts), [viewer-settings.test.tsx](/workspace/SkyLens/tests/unit/viewer-settings.test.tsx), and [aircraft-layer.test.ts](/workspace/SkyLens/tests/unit/aircraft-layer.test.ts).

## Milestones

### 1. Increase simulation/render cadence
- Replace the 1Hz scene clock in [viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) with an animation-driven loop using `requestAnimationFrame` plus an explicit throttle policy.
- Keep coarse cadence fallback for `prefers-reduced-motion`, inactive/unsupported animation contexts, and a battery-conscious low-power mode driven explicitly by `motionQuality='low'`.
- Preserve demo-mode relative time progression and live-mode wall-clock sync.
- Tests:
  - viewer-shell unit coverage proving continuous time advancement under the animation loop.
  - reduced-motion fallback coverage proving coarse cadence remains active.
  - low-quality motion setting coverage proving the battery-conscious cadence path uses the same throttled behavior intentionally.

### 2. Add aircraft temporal continuity between snapshots
- Replace single-snapshot aircraft rendering with previous/current snapshot retention keyed by aircraft id.
- Resolve render pose using interpolation when consecutive snapshots exist and bounded dead reckoning when only one recent sample with heading/velocity is available.
- Add stale-data handling and entry/exit fade treatment so aircraft do not teleport or pop abruptly when snapshots change.
- Keep polling cadence at 10 seconds unless implementation reveals a correctness blocker; smoothing happens client-side.
- Tests:
  - aircraft/viewer-shell coverage for smooth intermediate motion across snapshot boundaries,
  - bounded extrapolation horizon behavior,
  - stale-data fallback behavior.

### 3. Unify moving-object motion state by object type
- Introduce a reusable motion-state layer in [lib/viewer/motion.ts](/workspace/SkyLens/lib/viewer/motion.ts) and move render-pose resolution out of ad hoc viewer-shell logic.
- Support per-type policy:
  - satellites: deterministic propagation from catalog and current time,
  - aircraft: sampled state plus short-horizon prediction/confidence decay.
- Feed `buildSceneSnapshot` from the motion-state output without changing label ranking semantics, object ids, or selection behavior.
- Tests:
  - motion module unit coverage for confidence decay and per-type policy behavior,
  - viewer-shell regression coverage proving label/object ordering remains intact.

### 4. Add movement affordances and quality controls
- Extend persisted viewer settings with `motionQuality: 'low' | 'balanced' | 'high'` and expose it through [settings-sheet.tsx](/workspace/SkyLens/components/settings/settings-sheet.tsx).
- Generalize trails/vectors beyond the current ISS-focused trail behavior so moving satellites and aircraft share the same fidelity policy with per-quality limits.
- Add visual treatment for stale/extrapolated state that is additive and readable under both live and demo modes.
- Reduced-motion must continue to suppress motion-heavy affordances regardless of quality setting.
- Tests:
  - settings persistence/default coverage,
  - viewer-shell coverage for quality-dependent trail behavior and reduced-motion suppression.

### 5. Final verification and release hygiene
- Run `npm run test`.
- Run `npm run lint`.
- Confirm all new behavior is directly covered by tests before handoff.
- Create a clean commit after verification passes.
- Create the corresponding PR as the final delivery step; if repository tooling blocks PR creation at execution time, surface that as an explicit blocker rather than silently narrowing scope.

## Interfaces And Ownership
- [viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx)
  - Owns animation cadence, live/demo scene time policy, fetch polling, and wiring scene inputs into render state.
  - Should consume a motion-state API rather than duplicating per-object smoothing rules inline.
- [lib/viewer/motion.ts](/workspace/SkyLens/lib/viewer/motion.ts)
  - New local module for motion-state cache, object-type fidelity policy, confidence/staleness evaluation, and render-pose resolution.
  - Expected inputs: current time, prior motion state, current aircraft snapshot, current satellite catalog, enabled layers, and reduced-motion / quality policy as needed.
  - Expected outputs: resolved moving-object render objects plus metadata needed for trails, stale treatment, and confidence-aware UI.
- [lib/viewer/settings.ts](/workspace/SkyLens/lib/viewer/settings.ts)
  - Add normalized `motionQuality` with backward-compatible defaulting for existing persisted settings.
- [components/settings/settings-sheet.tsx](/workspace/SkyLens/components/settings/settings-sheet.tsx)
  - Add a motion-quality control without changing existing layer/alignment workflows.

## Compatibility Notes
- Keep the viewer settings storage key unchanged; normalize missing `motionQuality` to `balanced` so existing clients upgrade in place.
- Do not change public aircraft or satellite API routes unless implementation proves the current contracts are insufficient. Current aircraft data already includes `fetchedAt`, `headingDeg`, and `velocityMps`, which should be the default basis for short-horizon prediction.
- Preserve object ids, selection ids, label ranking inputs, and demo scenario routing so existing UI/tests remain semantically valid.
- Treat commit and PR creation as part of the required delivery workflow for this task unless a later authoritative clarification narrows that requirement.

## Regression Controls
- Invariants:
  - reduced-motion still disables animation-heavy transitions and trails,
  - `motionQuality='low'` acts as the explicit battery-conscious low-power policy for cadence and motion affordances,
  - live and demo viewer startup flows remain unchanged,
  - label ranking/order semantics do not change as a side effect of smoothing,
  - stale or degraded aircraft data never produces unbounded extrapolation.
- Primary regression surfaces:
  - animation cadence causing excess rerenders or broken demo/live time behavior,
  - motion-state changes altering object visibility/ranking unexpectedly,
  - backward compatibility for persisted settings,
  - trail/stale affordances obscuring current object selection or readability.
- Validation approach:
  - extend existing viewer-shell and settings suites first where possible,
  - add focused motion-state unit coverage for deterministic edge cases,
  - finish with repo-wide `test` and `lint`.

## Risk Register
- Animation loop increases render churn.
  - Mitigation: explicit throttle policy, reduced-motion fallback, explicit `motionQuality='low'` low-power mode, keep scene rebuild logic bounded.
  - Rollback: revert to coarse scene clock while retaining motion-state plumbing if needed.
- Aircraft dead reckoning can drift or outlive stale data.
  - Mitigation: cap extrapolation horizon, decay confidence quickly, suppress/fade stale objects.
  - Rollback: disable extrapolation and keep interpolation-only behavior.
- New motion-state abstraction can duplicate existing normalization logic or disturb label semantics.
  - Mitigation: keep the module narrow and feed existing `SkyObject` shapes back into the current snapshot pipeline.
  - Rollback: inline object-type-specific smoothing temporarily behind the same interfaces if integration becomes unstable.
- Persisted motion-quality setting can break old local storage payloads.
  - Mitigation: additive schema change with default normalization and settings tests.
  - Rollback: ignore stored `motionQuality` and fall back to `balanced`.
