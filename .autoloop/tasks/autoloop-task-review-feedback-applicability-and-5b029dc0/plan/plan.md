# Hybrid Star Rendering Review Plan

## Scope
- Review both supplied comments against the current `SkyLensServerless` implementation and ship only the fixes that are technically correct and materially useful.
- Limit code changes to:
  - `SkyLensServerless/components/viewer/star-point-canvas.tsx`
  - `SkyLensServerless/components/viewer/viewer-shell.tsx` only if memoization can actually stabilize `MainStarCanvas` input identity
- Preserve the existing hybrid canvas/DOM rendering model, object selection behavior, label behavior, and scope/main-view branching.

## Applicability Assessment
- `star-point-canvas.tsx`: applicable. The draw effect currently rewrites `canvas.width` and `canvas.height` on every effect run, which needlessly reallocates the backing store and resets 2D context state.
- `star-point-canvas.tsx`: applicable. Clearing with raw fractional viewport dimensions can leave edge pixels uncleared; `Math.ceil(widthPx)` / `Math.ceil(heightPx)` is a safe local fix.
- `viewer-shell.tsx`: conditionally applicable. A cosmetic `useMemo` on `mainViewDeepStarCanvasPoints` is not enough if its inputs are recreated every render. Memoization should be added only at the nearest effective derivation boundary inside `viewer-shell.tsx` that keeps the `MainStarCanvas` `stars` prop reference stable across unrelated rerenders.

## Phase 1: Apply safe redraw fixes and the nearest effective deep-star memoization
Milestone
- Remove avoidable canvas backing-store resets and ship deep-star memoization only if dependency analysis shows a real reduction in `MainStarCanvas` redraw triggers.

Implementation outline
- In `star-point-canvas.tsx`:
  - Derive rounded backing dimensions from `widthPx`, `heightPx`, and `devicePixelRatio`.
  - Only assign `canvas.width` / `canvas.height` when the backing dimensions actually changed.
  - Keep `context.setTransform(...)` in the resize path because canvas dimension writes reset context state.
  - Continue clearing and drawing on every effect run, but clear with ceiled CSS-pixel dimensions.
- In `viewer-shell.tsx`:
  - Inspect the derivation chain feeding `mainViewDeepStarCanvasPoints`, starting from `projectedDeepStars` / `mainViewRenderedDeepStars`.
  - Add memoization at the smallest local boundary that truly stabilizes the `MainStarCanvas` `stars` prop reference for unrelated `ViewerShell` rerenders.
  - Require the dependency list to cover every input that changes projected deep-star positions or visibility, including mount and scope gating where relevant.
  - If no local boundary provides stable identity without stale projections or widened refactors, leave the code unchanged and treat the suggestion as non-applicable.

## Interfaces / Compatibility
- `StarPointCanvas` props remain `widthPx`, `heightPx`, `points`, `testId`, `className`, and `style`.
- `ViewerShell` props, routing behavior, diagnostics, and rendered features remain unchanged.
- No API, config, storage, or data-shape changes are allowed.

## Regression Risks / Controls
- Risk: transform state could become stale after skipping redundant canvas dimension writes.
  - Control: only call `setTransform` when backing dimensions change, which is exactly when browser state resets.
- Risk: fractional viewport sizes could leave stale pixels at the canvas edges.
  - Control: clear with ceiled CSS-pixel dimensions before each redraw.
- Risk: memoization could freeze outdated deep-star positions, visibility, or mount/scope gating.
  - Control: memoize only with a complete dependency boundary and keep center-lock, selection, and label derivations reading from the live projected-object arrays.
- Risk: scope-mode logic could accidentally start sharing memoized main-view data.
  - Control: keep memoization confined to the main-view deep-star canvas path inside `viewer-shell.tsx`.

## Validation
- Run `npm test -- tests/unit/main-star-canvas.test.tsx` and extend that suite if needed to cover conditional backing-store resize behavior and fractional-size clearing.
- Run `npm test -- tests/unit/viewer-shell-scope-runtime.test.tsx` for the current main-view deep-star rendering path.
- If memoization is implemented, add or update a test proving that an unrelated `ViewerShell` rerender does not change the `MainStarCanvas` `stars` prop identity.
- Run `npm run build` because there is no dedicated typecheck script and this is the existing type-aware repo validation command.

## Rollback
- Revert the conditional backing-store resize logic independently if canvas rendering regresses under DPR or resize changes.
- Revert viewer-shell memoization independently if it does not stabilize redraw inputs or if it produces stale deep-star positions.
