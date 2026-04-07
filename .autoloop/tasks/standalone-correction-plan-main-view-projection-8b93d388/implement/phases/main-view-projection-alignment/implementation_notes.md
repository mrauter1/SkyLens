# Implementation Notes

- Task ID: standalone-correction-plan-main-view-projection-8b93d388
- Pair: implement
- Phase ID: main-view-projection-alignment
- Phase Directory Key: main-view-projection-alignment
- Phase Title: Main-View Projection Alignment
- Scope: phase-local producer artifact

## Files Changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/astronomy/constellations.ts`
- `SkyLensServerless/tests/unit/projection-camera.test.ts`
- `SkyLensServerless/tests/unit/celestial-layer.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`

## Symbols Touched
- `ViewerShell`
- `buildVisibleConstellations`
- `projectWorldPointToScreenWithProfile`

## Checklist Mapping
- Milestone 1: added shared non-scope `stageProjectionViewport` and `projectStageWorldPoint` helper in `viewer-shell.tsx`.
- Milestone 2: routed main objects, non-scope deep stars, constellation segments, and focused aircraft trails through the shared non-scope projector; scope-only projection paths remain unchanged.
- Milestone 3: added crop-mapping coverage for profile projection, added constellation hook coverage, added viewer DOM assertions for magnified main-view constellation/trail alignment, and added runnable serverless runtime coverage for magnified non-scope deep-star/bright-object co-location.

## Assumptions
- No authoritative clarification changed the phase scope.
- Root and `SkyLensServerless` test trees use separate `vitest` configs and both must be considered when validating changes in the serverless subtree.

## Preserved Invariants
- Scope lens overlay geometry and clipping were left on the existing scope-only projection path.
- Main-view magnification remains projection/FOV-only; no persistence or ranking logic changed.
- Deep-star emergence and center-lock ordering logic were not refactored.

## Intended Behavior Changes
- Main-view profile projection now carries camera source dimensions when available.
- Non-scope deep stars, constellation segments, and focused aircraft trails now share the active main-view projector under magnification.

## Known Non-Changes
- No scope-mode geometry changes.
- No persistence, optics range, or alignment preference changes.
- No E2E/demo assertions were added in this pass.

## Expected Side Effects
- Constellation callers can optionally supply a custom line projector without affecting existing wide-view callers.

## Validation Performed
- `pnpm install --frozen-lockfile`
- `pnpm exec vitest run tests/unit/projection-camera.test.ts tests/unit/celestial-layer.test.ts tests/unit/viewer-shell-celestial.test.ts`
- `../node_modules/.bin/vitest run --config vitest.config.ts tests/unit/viewer-shell-scope-runtime.test.tsx` (from `/workspace/SkyLens/SkyLensServerless`)
- `git diff --check`

## Deduplication / Centralization
- Centralized non-scope stage projection shape in one local helper instead of repeating per-object/per-overlay projection call payloads.
