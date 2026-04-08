# Implementation Notes

- Task ID: main-view-projection-performance-parity-rerun
- Pair: implement
- Phase ID: projection-context-and-hot-path
- Phase Directory Key: projection-context-and-hot-path
- Phase Title: Shared Non-Scope Projection Context
- Scope: phase-local producer artifact

## Files Changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/astronomy/constellations.ts`
- `SkyLensServerless/tests/unit/projection-camera.test.ts`
- `SkyLensServerless/tests/unit/celestial-layer.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`

## Symbols Touched
- `ViewerShell`
- `StageProjectionContext`
- `buildVisibleConstellations`
- `validateConstellationCatalog`

## Checklist Mapping
- Milestone 1 / shared non-scope projection context: completed in `viewer-shell.tsx`
- Milestone 1 / explicit source-dimension propagation + fallback coverage: completed in `projection-camera.test.ts`
- Milestone 1 / constellation validation out of per-frame path: completed in `constellations.ts` and `celestial-layer.test.ts`
- Milestone 4 / parity regression coverage for constellation projector wiring: completed in `viewer-shell-celestial.test.ts`
- Milestones 2-4 deep-star governor/settings/color work: intentionally deferred to later phases

## Assumptions
- Bundled constellation validation only needs to guarantee bundled catalog integrity against the bundled star catalog, not arbitrary caller-supplied catalogs.

## Preserved Invariants
- Scope-lens projection, clipping, and scope-only projector behavior stay unchanged.
- Main-view bright-object, deep-star, constellation, and focused-trail consumers still project through existing camera helpers.
- `ProjectViewport` fallback behavior in camera helpers remains backward compatible for legacy callers.

## Intended Behavior Changes
- Non-scope constellation endpoints now always receive the same stage projector context used by other aligned main-view consumers.
- Main-view stage projection context now materializes deterministic source-dimension fallback values before dispatching projection calls.
- Bundled constellation catalog validation now happens once at module initialization instead of on every `buildVisibleConstellations()` call.

## Known Non-Changes
- No scope-mode projection or clipping behavior changes.
- No deep-star governor, settings, diagnostics, or B-V color-parity changes in this phase.

## Expected Side Effects
- Invalid bundled constellation/star references now fail at module load rather than during the first render-path build.

## Validation Performed
- `cd SkyLensServerless && pnpm install --frozen-lockfile`
- `cd SkyLensServerless && pnpm exec vitest run tests/unit/projection-camera.test.ts tests/unit/celestial-layer.test.ts tests/unit/viewer-shell-celestial.test.ts`
- `cd SkyLensServerless && pnpm exec vitest run tests/unit/viewer-shell-scope-runtime.test.tsx`

## Deduplication / Centralization
- Centralized non-scope projection inputs in one local `StageProjectionContext` so markers, deep stars, constellation segments, and focused trails share the same stage viewport/profile/projector tuple.
