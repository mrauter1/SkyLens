# Implementation Notes

- Task ID: execute-the-movement-fidelity-plan-defined-in-mo-8533d92f
- Pair: implement
- Phase ID: motion-affordances-and-controls
- Phase Directory Key: motion-affordances-and-controls
- Phase Title: Add motion affordances and quality controls
- Scope: phase-local producer artifact

## Files changed
- `components/settings/settings-sheet.tsx`
- `components/viewer/viewer-shell.tsx`
- `lib/viewer/motion.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-motion.test.ts`
- `tests/unit/viewer-settings.test.tsx`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/viewer-shell.test.ts`
- `.autoloop/tasks/execute-the-movement-fidelity-plan-defined-in-mo-8533d92f/decisions.txt`

## Symbols touched
- `SettingsSheet`
- `ViewerShell`
- `resolveSatelliteMotionObjects`
- `resolveSatelliteMotionObject`
- `renderMotionAffordance`
- `renderObjectBadges`
- `getMotionAffordanceKind`
- `getMovingObjectMotionLabel`
- `getMovingObjectMotionBadge`

## Checklist mapping
- Plan milestone 4 / AC-1: exposed persisted `motionQuality` controls in the settings sheet and verified missing stored values still normalize to `balanced`.
- Plan milestone 4 / AC-2: replaced the fixed trail behavior with quality-dependent motion affordances (`low` vector, `balanced`/`high` trails), generalized eligibility to moving aircraft and satellites, and kept reduced-motion suppression intact.
- Plan milestone 4 / stale treatment: propagated stale satellite-cache state into moving-object metadata so marker/detail affordances match aircraft stale handling.

## Assumptions
- The phase-local scope does not require multi-object historical trails; keeping affordances attached to the active moving summary object preserves current UI focus and keeps the blast radius small.

## Preserved invariants
- Viewer settings storage key remains unchanged and missing `motionQuality` still upgrades to `balanced`.
- Reduced-motion continues to suppress motion affordances regardless of stored quality.
- Object ids, selection semantics, and label ranking inputs remain unchanged.
- Non-moving object rendering paths were not altered.

## Intended behavior changes
- Settings now expose `Low`, `Balanced`, and `High` motion quality controls.
- `motionQuality='low'` renders a short vector; `balanced` and `high` render trails with different history limits.
- Stale satellite catalogs now visually downgrade propagated satellite markers/details through shared moving-object metadata.
- Stale ISS satellites keep the existing ISS badge alongside the new stale-state badge so the treatment remains additive.

## Known non-changes
- Startup permission flow and non-moving object display modes were not changed.
- Aircraft/satellite API contracts were not expanded.
- Motion affordances still follow the active summary object instead of all moving objects simultaneously.

## Expected side effects
- Satellite markers/details can now show stale-state labeling/opacity when the TLE cache is stale.
- Quality toggles affect both cadence policy (existing behavior) and visible motion affordances.

## Deduplication / centralization
- Reused shared moving-object metadata in `lib/viewer/motion.ts` so aircraft and satellites flow through the same viewer-shell label/badge/opacity helpers.
- Kept badge composition centralized inside `renderObjectBadges` instead of branching ISS+stale combinations at each detail-card call site.

## Validation performed
- `npm test -- --run tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-motion.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`
- `npx eslint components/settings/settings-sheet.tsx components/viewer/viewer-shell.tsx lib/viewer/motion.ts tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-motion.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts` reported pre-existing `viewer-shell.tsx` lint errors in untouched code (`videoElement.srcObject` immutability and `Date.now()` purity) and did not surface new phase-specific lint failures outside that file.
- Added regression coverage for stale ISS detail rendering so additive badge behavior is pinned at the viewer layer.
