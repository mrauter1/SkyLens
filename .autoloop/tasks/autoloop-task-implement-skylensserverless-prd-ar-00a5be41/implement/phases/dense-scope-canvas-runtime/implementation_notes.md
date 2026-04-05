# Implementation Notes

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: implement
- Phase ID: dense-scope-canvas-runtime
- Phase Directory Key: dense-scope-canvas-runtime
- Phase Title: Dense Scope Canvas Runtime
- Scope: phase-local producer artifact
- Files changed:
  `SkyLensServerless/components/viewer/viewer-shell.tsx`
  `SkyLensServerless/components/viewer/scope-lens-overlay.tsx`
  `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
  `SkyLensServerless/lib/scope/catalog.ts`
  `SkyLensServerless/lib/scope/coordinates.ts`
  `SkyLensServerless/lib/scope/depth.ts`
  `SkyLensServerless/lib/scope/position-tiles.ts`
  `SkyLensServerless/tests/unit/scope-lens-overlay.test.tsx`
  `SkyLensServerless/tests/unit/scope-runtime.test.ts`
  `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- Symbols touched:
  `ViewerShell`
  `ScopeLensOverlay`
  `ScopeStarCanvas`
  `loadScopeManifest`
  `loadScopeNamesTable`
  `loadScopeBandIndex`
  `loadScopeTileRows`
  `createScopeRequestTracker`
  `selectScopeBand`
  `areScopeDeepStarsDaylightSuppressed`
  `convertScopeHorizontalToEquatorial`
  `convertScopeEquatorialToHorizontal`
  `applyScopeProperMotion`
  `selectScopeTilesForPointing`
- Checklist mapping:
  Plan milestone 5: added cached scope runtime modules, adaptive band selection, RA-wrap tile selection, proper-motion coordinate conversion, Canvas 2D deep-star rendering, and named deep-star scope center-lock/detail integration.
  Plan milestone 6: added targeted runtime/viewer regression tests and re-ran existing scope-focused viewer suites.
- Assumptions:
  Reusing `astronomy-engine` low-level rotation helpers is acceptable because the installed package exports `Rotation_EQJ_HOR` and `Rotation_HOR_EQJ`.
  Scope tile selection may be recomputed from the current lens center/time each render, but network work only changes when the selected tile file set changes.
- Preserved invariants:
  Wide markers/labels/constellations remain unchanged outside the lens.
  Deep scope stars never enter `renderedMarkerObjects`, hover, or selection state.
  Scope loader failures remain non-fatal; the lens still shows background and bright-object overlay.
- Intended behavior changes:
  Scope mode now lazy-loads manifest/names/index data, fetches only the active band tiles for the current tile set, and ignores stale async responses after scope disable or tile-set changes.
  Named deep scope stars can now win scope center-lock/detail while staying canvas-rendered and pointer-inert.
  High-declination tile selection now widens RA coverage from the worst declination touched by the padded view so polar-edge deep stars are not skipped.
- Known non-changes:
  No direct pointer interaction was added inside the lens.
  No WebGL/WebGPU or hardware zoom path was introduced.
  No out-of-phase dataset build contract changes were made.
- Expected side effects:
  Scope-enabled renders now perform session-cached static-file fetches from `/data/scope/v1/` on first use and when the active tile set changes.
  JSDOM scope tests emit the existing `HTMLCanvasElement.getContext` warning unless the specific test stubs the canvas API.
- Deduplication / centralization:
  Catalog caching and stale-generation helpers were centralized in `lib/scope/catalog.ts` instead of duplicating fetch/cache logic inside `ViewerShell`.
  Coordinate transforms and PM adjustment were centralized in `lib/scope/coordinates.ts`.
- Validation performed:
  `npx eslint /workspace/SkyLens/SkyLensServerless/lib/scope/position-tiles.ts /workspace/SkyLens/SkyLensServerless/tests/unit/scope-runtime.test.ts`
  `npx eslint lib/scope/coordinates.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/scope-runtime.test.ts`
  `npx vitest run tests/unit/scope-runtime.test.ts tests/unit/scope-lens-overlay.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx`
  `npx vitest run tests/unit/viewer-shell.test.ts --testNamePattern "scope"`
  `npx vitest run tests/unit/viewer-shell-celestial.test.ts --testNamePattern "scope"`
  `npx eslint components/viewer/viewer-shell.tsx components/viewer/scope-lens-overlay.tsx components/viewer/scope-star-canvas.tsx lib/scope/catalog.ts lib/scope/coordinates.ts lib/scope/depth.ts lib/scope/position-tiles.ts tests/unit/scope-lens-overlay.test.tsx tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`
  Note: the broader existing `viewer-shell.tsx` ESLint run still reports pre-existing `react-hooks/exhaustive-deps` warnings unrelated to this phase’s added scope runtime paths.
