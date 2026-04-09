# Main-view Deep-star Canvas Memoization Plan

## Objective
Stabilize the `MainStarCanvas` `stars` prop in `SkyLensServerless/components/viewer/viewer-shell.tsx` so unrelated `ViewerShell` rerenders do not retrigger `StarPointCanvas` redraws from array reference churn, while preserving deep-star visibility, projection, center-lock, and label behavior.

## Relevant surfaces
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
  Current chain in the repo: memoized `projectedDeepStars` -> memoized `mainViewRenderedDeepStars` -> memoized `mainViewDeepStarCanvasPoints` -> `renderedMainViewDeepStarCanvasPoints`.
- `SkyLensServerless/components/viewer/star-point-canvas.tsx`
  Redraws inside `useEffect(..., [heightPx, points, widthPx])`, so any new `points` array reference causes a full canvas clear/redraw.
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  Already covers main-view deep-star canvas behavior and has canvas draw stubs that can detect redundant redraws, but `rerenderViewerWithSettings` currently unmounts/remounts and cannot serve as memoization proof.

## Implementation contract
### Milestone 1: Stabilize the main-view deep-star canvas input
- Audit the existing `useMemo` chain in `viewer-shell.tsx` and keep or adjust only the smallest contiguous derivation chain that actually stabilizes the array passed to `MainStarCanvas`.
- Starting assumption from the current repo state:
  1. `projectedDeepStars` is the earliest effective memo boundary because it captures projection, optics, viewport, and dataset inputs.
  2. `mainViewRenderedDeepStars` and `mainViewDeepStarCanvasPoints` should continue to reuse that stable upstream array unless dependency review proves a narrower safe boundary.
- Preserve the existing gates exactly:
  - no main-view deep-star canvas points before mount,
  - no main-view deep-star canvas points while scope mode is active,
  - same projection coordinates, alpha/radius/color payload, and deep-star membership.
- Reuse memoized arrays downstream only where it is behaviorally identical; do not refactor label, center-lock, or diagnostics pipelines beyond safe reuse of the stabilized derived arrays.

### Milestone 2: Prove unrelated rerenders no longer redraw the canvas
- Extend `viewer-shell-scope-runtime.test.tsx` with a same-mounted rerender case.
- Preferred proof path: use `openDesktopViewerPanel()`, which updates local `ViewerShell` UI state without unmounting and should not alter deep-star points.
- If implementation instead needs a settings-based rerender, add a same-root rerender helper; do not use `rerenderViewerWithSettings` as evidence because it unmounts/remounts the tree.
- Assert:
  - the main-view deep-star canvas still renders the expected stars,
  - the unrelated rerender does not add new canvas draw calls,
  - existing center-lock/label membership expectations remain intact where the test already exercises them.
- Do not use the existing unmount/remount rerender helper as proof of memoization; remounting necessarily redraws the canvas and does not validate stable prop identity.

## Interfaces / dependencies
- `MainStarCanvas` and `StarPointCanvas` public props remain unchanged.
- Memo dependencies must include every input that can change deep-star canvas membership or payload values:
  - mount/scope-mode gates,
  - deep-star source rows / visibility filtering,
  - projection inputs,
  - optics-derived alpha/radius inputs when the memo boundary includes those calculations.
- Preserve the current explicit primitive dependency style in `projectedDeepStars` where practical; avoid collapsing it into broader object dependencies that make stale renders harder to reason about.
- Prefer primitive or already-stable dependency values over inline object literals/closures that would nullify memoization.

## Compatibility
- No public API, config, persisted data, or developer workflow changes.
- No intentional behavior changes are allowed for deep-star visibility, selection, center-lock ordering, or label candidate participation.

## Regression risks and controls
- Risk: stale memo dependencies freeze canvas points after optics, camera pose, viewport, or deep-star dataset changes.
  Control: derive dependencies from every value that influences point inclusion or point payload; keep the memo boundary narrow and traceable.
- Risk: simplifying the current memo chain to only the final `.map()` reintroduces redraw churn because upstream arrays still change identity on unrelated rerenders.
  Control: treat `projectedDeepStars` as the default effective boundary unless implementation proves a narrower boundary is equally stable.
- Risk: test passes while still allowing redraws because the test remounts the component.
  Control: use `openDesktopViewerPanel()` or another same-mounted path and inspect canvas draw call counts around that state change.

## Validation
- Run focused Vitest coverage for:
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - `SkyLensServerless/tests/unit/main-star-canvas.test.tsx` if touched or if canvas draw assertions need confirmation
- Run `npx tsc --noEmit` in `SkyLensServerless`.
- Run `npm run build` in `SkyLensServerless`.

## Rollback
- Revert the memoized derivation chain and the redraw-prevention test if the change introduces stale canvas output or brittle dependency management.
