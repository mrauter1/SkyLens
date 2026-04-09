# Implementation Notes

- Task ID: memoize-main-view-deep-star-canvas-points-20260409
- Pair: implement
- Phase ID: stabilize-main-view-deep-star-canvas-points
- Phase Directory Key: stabilize-main-view-deep-star-canvas-points
- Phase Title: Stabilize main-view deep-star canvas points
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/tests/unit/aircraft-tracker.test.ts`
- `SkyLensServerless/tests/unit/scope-data-build.integration.test.ts`
- `SkyLensServerless/tests/unit/scope-data-dev-fallback.test.ts`
- `SkyLensServerless/tests/unit/scope-data-download.test.ts`
- `SkyLensServerless/tests/unit/scope-data-names.test.ts`
- `SkyLensServerless/tests/unit/scope-data-parse.test.ts`
- `SkyLensServerless/tests/unit/scope-data-tiling.test.ts`
- `SkyLensServerless/tests/unit/scope-data-verify.test.ts`
- `SkyLensServerless/tests/unit/scope-runtime.test.ts`
- `SkyLensServerless/tests/unit/serve-export.test.ts`
- `SkyLensServerless/tests/unit/settings-sheet.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `.autoloop/tasks/memoize-main-view-deep-star-canvas-points-20260409/decisions.txt`

## Symbols touched
- `createAircraft`
- `buildDevSyntheticStars` test harness typing
- `.mjs` script test imports
- `binaryResponse`
- `TEMP_DIRECTORIES`
- `stubCanvasContext`
- `canvasRedrawCount`
- `openDesktopViewerPanel`

## Checklist mapping
- Milestone 1: Confirmed the current `viewer-shell.tsx` memo chain already keeps `projectedDeepStars`, `mainViewRenderedDeepStars`, and `mainViewDeepStarCanvasPoints` stable at the effective upstream boundary; no further code change was needed there in this turn.
- Milestone 2: Added a same-mounted desktop viewer panel rerender test and explicit canvas redraw counter coverage.
- AC-4 follow-through: Fixed repo-included test typing issues blocking `npx tsc --noEmit` so the required `SkyLensServerless` typecheck target now passes.

## Assumptions
- Opening the desktop viewer panel is an unrelated `ViewerShell` rerender that should not affect deep-star projection inputs.
- Fixing test-only typing issues in other `SkyLensServerless` test files is acceptable because the project typecheck target includes those files and AC-4 explicitly requires that target to pass.

## Preserved invariants
- Main-view and scope-mode deep-star visibility gates remain unchanged.
- Deep-star projection, center-lock, and label candidate participation still derive from the same projected deep-star objects.
- The canvas remains mount-gated and disabled while scope mode is active.

## Intended behavior changes
- Unrelated `ViewerShell` rerenders no longer recreate the main-view deep-star canvas input arrays or retrigger canvas redraws.

## Known non-changes
- No changes to `ViewerShell`, `MainStarCanvas`, or `StarPointCanvas` rendering logic in this turn.
- No changes to script runtime behavior in `scripts/scope/*.mjs` or `scripts/serve-export.mjs`; only test typing coverage around those imports changed.
- No refactor of bright-object marker, label layout, or scope canvas pipelines beyond safe memo reuse.

## Expected side effects
- Reduced main-view deep-star projection and canvas work when desktop/mobile shell state changes without affecting deep-star inputs.
- Cleaner repo-wide TypeScript validation for existing tests without changing runtime code paths.

## Validation performed
- `npx vitest run tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/aircraft-tracker.test.ts tests/unit/scope-data-build.integration.test.ts tests/unit/scope-data-dev-fallback.test.ts tests/unit/scope-data-download.test.ts tests/unit/scope-data-names.test.ts tests/unit/scope-data-parse.test.ts tests/unit/scope-data-tiling.test.ts tests/unit/scope-data-verify.test.ts tests/unit/serve-export.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-runtime.test.ts` ✅
- `npx tsc --noEmit` ✅
- `npm run build` ✅

## Deduplication / centralization decisions
- Kept memoization local to `ViewerShell`; no new shared memo helpers or canvas abstractions added.
- Kept `.mjs` import typing fixes localized to the affected tests instead of broad tsconfig changes.
