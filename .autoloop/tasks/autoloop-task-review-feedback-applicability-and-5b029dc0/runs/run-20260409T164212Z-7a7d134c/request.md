# Autoloop Task: Review Feedback Applicability and Fixes for Hybrid Star Rendering

## Objective
Analyze the provided code review suggestions for correctness and applicability, then implement only the applicable fixes in `SkyLensServerless`.

## Review comments to analyze
1. `SkyLensServerless/components/viewer/star-point-canvas.tsx`
   - Suggestion: avoid resetting `canvas.width`/`canvas.height` on every render by only updating dimensions when changed; keep transform updates tied to size changes; use `Math.ceil` in `clearRect` dimensions.

2. `SkyLensServerless/components/viewer/viewer-shell.tsx`
   - Suggestion: memoize `mainViewDeepStarCanvasPoints` with `useMemo` so the canvas does not redraw due to a new array reference on every render.

## Required approach
- Evaluate each suggestion for technical correctness and whether it applies to current code.
- Implement applicable suggestions with minimal, production-safe changes.
- Preserve existing behavior and architecture goals for hybrid canvas/DOM rendering.
- Update/add tests only as needed to validate changed behavior.

## Acceptance criteria
- `star-point-canvas.tsx` only resizes backing canvas when dimensions actually change.
- Canvas clearing behavior remains correct for fractional viewport sizes.
- `mainViewDeepStarCanvasPoints` is memoized appropriately (if applicable) to prevent unnecessary redraw triggers.
- Build/typecheck/tests for changed area pass.
- No unrelated refactors.

## Execution requirements
Use autoloop with:
- full-auto answers enabled
- pairs: plan, implement, test
- no max-iterations parameter
