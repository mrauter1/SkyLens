# SkyLensServerless Review Applicability And Fixes Plan

## Scope
- Evaluate the two review items against the current `SkyLensServerless` implementation.
- Apply only technically correct suggestions.
- Add focused automated tests for the accepted behavior change and document the rejected review in task artifacts.

## Review Findings
- `scopeProjectionProfile` memoization is **not applicable** in the current code. `createProjectionProfile({ verticalFovDeg })` is a cheap pure calculation, the result is consumed only within the same render, and no current effect, memo, or child-prop identity contract depends on object stability. Adding `useMemo` would increase complexity without preventing a real recomputation or regression surface.
- The scope tile selection radius review is **correct and applicable**. `ViewerShell` computes the deep-star tile selection radius from the full stage viewport, but scope rendering and in-lens visibility use a square lens viewport sized from `scopeLensDiameterPx`. On non-square stage aspect ratios, the current radius can underfetch in portrait and overfetch in landscape/wide layouts.

## Implementation Milestone
### Milestone 1: Fix scope tile radius and document rejected memoization
- Keep `scopeProjectionProfile` as an inline render-local value.
- Change the `ViewerShell` call site for `getScopeTileSelectionRadiusDeg` to use the lens viewport dimensions (`scopeLensDiameterPx` for both width and height).
- If needed for clarity and reuse, keep the radius math in `lib/scope/position-tiles.ts`, but do not introduce new abstractions beyond what the current call site needs.
- Document in task artifacts that the memoization suggestion was reviewed and intentionally not applied; do not add instrumentation or implementation-detail tests for this rejected no-op review item.

## Interfaces / Affected Files
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
  - Change the scope tile selection radius inputs only.
- `SkyLensServerless/lib/scope/position-tiles.ts`
  - Preserve the current radius API unless a minimal signature adjustment is required by implementation clarity.
- `SkyLensServerless/tests/unit/scope-runtime.test.ts`
  - Add/adjust unit coverage for radius behavior using square lens dimensions.
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Add/adjust runtime coverage if needed to prove the selected tile set follows the lens viewport rather than the full stage viewport.
- Task artifacts
  - Record the rejected memoization review and why it is artifact-only rather than an automated test target.

## Compatibility / Behavior Notes
- No public API, persisted data, routing, or configuration changes are expected.
- Wide-view rendering behavior must remain unchanged.
- Scope deep-star loading should change only where the current full-stage aspect ratio misselects scope tiles; bright scope objects, lens overlay sizing, and center-lock behavior must remain intact.

## Regression Risks
- Fetching too many tiles if the corrected radius is wired incorrectly.
- Fetching too few tiles near the lens edge if the radius loses the existing padding behavior.
- Accidentally widening task scope by adding unnecessary memoization or refactors in `ViewerShell`.

## Validation
- Run the focused unit tests covering scope runtime selection and `ViewerShell` scope runtime behavior for the accepted lens-viewport fix.
- Ensure tests explicitly cover an aspect-ratio mismatch case where the full stage viewport and square lens viewport would yield different tile-selection radii.
- Validate the rejected memoization review through task-artifact documentation only, because the current code has no observable behavior or interface contract tied to `scopeProjectionProfile` object identity.

## Rollback
- Revert the `ViewerShell` scope tile radius input change.
- Keep the artifact decision that the memoization suggestion was rejected unless later profiling or code changes create an identity-sensitive consumer.
