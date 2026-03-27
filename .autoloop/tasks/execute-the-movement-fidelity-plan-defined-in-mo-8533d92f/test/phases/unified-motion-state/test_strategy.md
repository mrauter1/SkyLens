# Test Strategy

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: test
- Phase ID: unified-motion-state
- Phase Directory Key: unified-motion-state
- Phase Title: Introduce shared motion-state pipeline
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Shared motion-state API: `tests/unit/viewer-motion.test.ts`
  Covers aircraft estimated-state prediction from a single fresh sample, aircraft confidence decay into stale state, deterministic satellite propagation metadata, and shared-pipeline id preservation across aircraft plus satellites.
- Viewer integration and preserved semantics: `tests/unit/viewer-shell.test.ts`
  Covers scene-time wiring through the shared motion module seam and preserves existing aircraft snapshot retention, stale/estimated metadata presentation, and selected-object semantics.
- Label-order and moving-layer regression safety: `tests/unit/viewer-shell-celestial.test.ts`
  Covers top-list behavior with moving objects supplied by the shared motion-state layer, trail rendering on the low-power cadence path, and independent aircraft vs satellite failure isolation in both directions.
- Label ranking invariant: `tests/unit/label-ranking.test.ts`
  Confirms the shared motion extraction did not change existing label prioritization budgets or deterministic ranking behavior.

## Preserved invariants checked
- Moving-object ids remain unchanged when resolved through the shared motion pipeline.
- Viewer selection and detail-card behavior still key off the existing normalized `SkyObject` contract.
- Label ranking / top-list selection semantics stay intact when moving objects come from the new motion module.
- One moving layer throwing does not blank the other moving layer.

## Edge cases and failure paths
- Current-only aircraft use bounded prediction instead of teleporting.
- Aging aircraft confidence decays before suppression.
- Satellite propagation remains deterministic for fixture input.
- Satellite resolver failure while aircraft succeed.
- Aircraft resolver failure while satellites succeed.

## Stabilization approach
- Use fixed timestamps and fixture observers for motion-state unit tests.
- Mock per-type motion resolvers in viewer tests to isolate scene-builder behavior without depending on unrelated astronomy paths.
- Keep label-ranking assertions data-driven and deterministic rather than DOM-timing-driven.

## Known gaps
- No new coverage for Pair 4 quality-setting UI or generalized trail controls; those are intentionally out of phase.
