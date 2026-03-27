# Implementation Notes

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: implement
- Phase ID: unified-motion-state
- Phase Directory Key: unified-motion-state
- Phase Title: Introduce shared motion-state pipeline
- Scope: phase-local producer artifact

## Files changed
- `lib/viewer/motion.ts`
- `components/viewer/viewer-shell.tsx`
- `lib/aircraft/client.ts`
- `lib/satellites/client.ts`
- `tests/unit/viewer-motion.test.ts`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`

## Symbols touched
- `resolveMovingSkyObjects`
- `resolveAircraftMotionObjects`
- `resolveSatelliteMotionObjects`
- `buildSceneSnapshot`
- `normalizeAircraftObjects`
- `normalizeSatelliteObjects`

## Checklist mapping
- Pair 3 / Implement: added shared `lib/viewer/motion.ts` and moved moving-object render-pose resolution there.
- Pair 3 / Implement: integrated shared motion-state resolution into `buildSceneSnapshot` while preserving independent aircraft vs satellite failure handling.
- Pair 3 / Test: added direct motion policy/confidence tests and updated viewer-shell regression coverage to use the shared resolver seam.
- Deferred intentionally: no Pair 4 settings/UI or trail-policy expansion beyond preserving current behavior.

## Assumptions
- Existing aircraft and satellite object contracts remain the compatibility boundary for downstream UI.
- Shared motion-state coverage can validate label-order safety by keeping viewer-shell top-list behavior stable when moving objects arrive via the new resolver.

## Preserved invariants
- Object ids remain unchanged for aircraft and satellites.
- Viewer selection behavior still keys off existing `SkyObject` ids.
- Label ranking inputs and moving-object ordering in `buildSceneSnapshot` remain aircraft → celestial → satellites → stars.
- Aircraft and satellite resolution failures remain isolated so one moving layer can still render if the other throws.
- Reduced-motion and existing trail suppression behavior were not changed in this phase.

## Intended behavior changes
- Moving-object render poses now resolve through a single motion-state API with per-type policies:
- Aircraft use retained snapshots plus bounded prediction/confidence decay.
- Satellites use deterministic propagation with explicit propagated-state semantics.

## Known non-changes
- No viewer settings persistence or settings-sheet UI changes.
- No non-moving celestial behavior changes.
- No API contract expansion for aircraft or TLE routes.

## Expected side effects
- `viewer-shell` tests now mock the shared motion module’s per-type resolvers instead of the per-layer client normalizers.
- Aircraft and satellite client modules still expose the previous normalization helpers for compatibility, but they delegate into the shared resolver.

## Validation performed
- `npm test -- tests/unit/viewer-motion.test.ts tests/unit/aircraft-layer.test.ts tests/unit/satellite-layer.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/label-ranking.test.ts`
- `npm run lint -- components/viewer/viewer-shell.tsx lib/aircraft/client.ts lib/satellites/client.ts lib/viewer/motion.ts tests/unit/viewer-motion.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/aircraft-layer.test.ts tests/unit/satellite-layer.test.ts` (blocked by pre-existing `components/viewer/viewer-shell.tsx` hook/purity lint errors outside this phase’s touched lines)
- `npx eslint lib/viewer/motion.ts lib/aircraft/client.ts lib/satellites/client.ts tests/unit/viewer-motion.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`

## Deduplication / centralization
- Consolidated duplicated aircraft interpolation/dead-reckoning and satellite propagation policy into `lib/viewer/motion.ts`.
- Kept legacy layer client entry points as thin adapters to avoid wider call-site churn.
