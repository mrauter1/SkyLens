# Review Feedback Fix Plan

## Objective
Analyze the two review suggestions against the current `SkyLensServerless` hybrid-rendering code, implement only the technically applicable fixes, and keep behavior unchanged outside the intended canvas redraw optimization.

## Review Assessment
- `SkyLensServerless/components/viewer/star-point-canvas.tsx`: Applicable. The current effect resets `canvas.width` and `canvas.height` on every redraw because `points` is in the effect dependency list. That clears the backing store and resets canvas state even when only star data changes. The fix should guard backing-store resizes by comparing the desired DPR-scaled dimensions to the current backing size, keep `setTransform` tied to actual resize/DPR changes, and clear using `Math.ceil(widthPx)` / `Math.ceil(heightPx)` so fractional viewport sizes do not leave uncleared edges.
- `SkyLensServerless/components/viewer/viewer-shell.tsx`: Directionally correct but not automatically applicable as written. `mainViewDeepStarCanvasPoints` is derived from freshly materialized projection arrays in the render path, so a naive `useMemo` around the final array keyed by another freshly created array would not stop redraw churn. Only implement memoization if there is a local, dependency-stable boundary that actually preserves the canvas-point array reference across unrelated renders. Do not add a placebo `useMemo`.

## Implementation Contract
### Milestone 1: Fix shared star-canvas resize and clear behavior
- Update `star-point-canvas.tsx` so backing-store dimensions are only reassigned when the DPR-scaled width or height actually changes.
- Keep DPR transform resets coupled to that same resize path so redraws with unchanged dimensions do not repeatedly reset the canvas state.
- Continue redrawing points on every relevant effect run, but clear the logical viewport with ceil-rounded dimensions before repainting.
- Keep the public props and draw semantics unchanged for both `MainStarCanvas` and `ScopeStarCanvas`.

### Milestone 2: Reassess the viewer-shell memoization comment without broadening scope
- Inspect whether `mainViewDeepStarCanvasPoints` can be memoized from a stable local dependency boundary inside `viewer-shell.tsx`.
- If such a boundary exists locally and prevents unnecessary `MainStarCanvas` redraw triggers, add the narrowest `useMemo` needed.
- If no stable local boundary exists without broader projection-pipeline memoization, leave `viewer-shell.tsx` unchanged and treat the review note as not applicable in the current architecture.
- Do not broaden the work into large-scale memoization of scene projection, camera-pose derivation, or unrelated render-path cleanup.

### Milestone 3: Validate the changed behavior
- Add or update focused unit coverage around the shared canvas behavior that owns the resize and clear logic.
- Prefer extending existing canvas tests (`main-star-canvas` and, if needed, `scope-star-canvas`) over introducing broad new integration coverage.
- Run the targeted `SkyLensServerless` test/typecheck commands needed to prove the changed area still passes.

## Interfaces And Compatibility
- `StarPointCanvas` props remain unchanged:
  - `widthPx: number`
  - `heightPx: number`
  - `points: StarPointCanvasPoint[]`
  - `testId: string`
  - optional `className` / `style`
- `MainStarCanvas` and `ScopeStarCanvas` remain thin wrappers over the shared canvas primitive; no API, settings, routing, or persisted-data changes are planned.
- No intentional user-visible behavior change is planned. The only acceptable delta is avoiding unnecessary backing-store resets and, only if truly effective, avoiding unnecessary main-view deep-star canvas redraws.

## Regression Risks And Controls
- Risk: tying `setTransform` to the wrong condition could leave the canvas in an unscaled state after mount or DPR changes.
  Control: compute desired DPR-scaled backing dimensions first, resize only when they differ, and keep transform updates on that same branch.
- Risk: fractional viewport sizes could still leave stale pixels if clear bounds stay truncated.
  Control: use ceil-rounded logical clear dimensions and cover the case in unit tests.
- Risk: a naive `useMemo` in `viewer-shell.tsx` could add complexity without reducing redraws.
  Control: require proof of a stable memoization boundary before changing `viewer-shell`; otherwise leave it unchanged.
- Risk: tests could overfit implementation details of the canvas internals.
  Control: assert the observable behavior that matters here: resize guard, transform behavior, clear dimensions, and preserved star drawing.

## Validation Plan
- Targeted tests:
  - `SkyLensServerless/tests/unit/main-star-canvas.test.tsx`
  - `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx` if shared-canvas assertions need coverage from the scope wrapper too
  - any viewer-shell test only if a real `viewer-shell.tsx` memoization change is made
- Type/build checks:
  - targeted `vitest` for the touched suites
  - targeted typecheck/build command for `SkyLensServerless` if the existing workflow requires it for touched files
- Manual verification only if test behavior is ambiguous:
  - non-scope and scope star canvases still draw correctly after rerender
  - no stale canvas pixels remain when viewport sizes include fractional values

## Rollback
- Revert the `star-point-canvas.tsx` resize guard and clear-dimension changes if redraws or DPR scaling regress.
- Revert any `viewer-shell.tsx` memoization independently if it does not produce a stable canvas input or complicates the render path.
