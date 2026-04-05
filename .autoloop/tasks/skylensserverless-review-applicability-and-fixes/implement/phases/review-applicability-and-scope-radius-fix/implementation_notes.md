# Implementation Notes

- Task ID: skylensserverless-review-applicability-and-fixes
- Pair: implement
- Phase ID: review-applicability-and-scope-radius-fix
- Phase Directory Key: review-applicability-and-scope-radius-fix
- Phase Title: Evaluate Review Items And Correct Scope Radius Selection
- Scope: phase-local producer artifact

## Files Changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/scope-runtime.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`

## Symbols Touched
- `ViewerShell`
- `getScopeTileSelectionRadiusDeg`
- `selectScopeTilesForPointing`
- `resetScopeCatalogSessionCacheForTests`

## Checklist Mapping
- Plan Milestone 1: kept `scopeProjectionProfile` inline and unchanged.
- Plan Milestone 1: updated the `ViewerShell` scope tile radius call site to use `scopeLensDiameterPx` for both viewport dimensions.
- Plan Milestone 1: added focused scope runtime coverage for portrait underfetch and wide overfetch cases caused by non-square stage aspect ratios.
- Plan Milestone 1: added a `ViewerShell` runtime test proving portrait scope tile fetches now follow the square lens viewport.
- Plan Milestone 1: documented the rejected memoization review in shared artifacts only; no identity instrumentation or tests were added.

## Assumptions
- The existing scope lens sizing contract remains `getScopeLensDiameterPx(viewport)` and should continue to define the square viewport that scope rendering uses.
- Session-level scope catalog caching is production behavior, but tests that swap synthetic datasets must reset that cache to stay isolated.

## Preserved Invariants
- `scopeProjectionProfile` remains a render-local value with no memoization added.
- Scope lens overlay sizing, deep-star band selection, and scope projection logic remain unchanged outside the tile-selection viewport input.
- No public interfaces, persisted settings, or routing behavior changed.

## Intended Behavior Changes
- Scope deep-star tile selection now matches the square lens viewport instead of the full stage viewport, preventing portrait underfetch and wide-layout overfetch.

## Known Non-Changes
- No broader `ViewerShell` performance refactors were introduced.
- No automated test targets were added for the rejected memoization review because there is still no observable identity contract to lock.

## Expected Side Effects
- Portrait layouts may fetch one or more additional edge tiles that were previously omitted.
- Wide layouts may avoid fetching tiles that are outside the actual scope lens visibility envelope.

## Validation Performed
- Installed locked dependencies with `npm ci` because the workspace was missing `node_modules`.
- Passed: `npm exec -- vitest run tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`

## Deduplication / Centralization
- Kept the selection-radius math centralized in `lib/scope/position-tiles.ts`; only the `ViewerShell` viewport input changed.
