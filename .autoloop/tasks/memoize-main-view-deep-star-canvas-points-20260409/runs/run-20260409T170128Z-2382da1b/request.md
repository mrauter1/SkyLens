# Autoloop Task: Implement applicable memoization for mainViewDeepStarCanvasPoints

## Goal
Implement the inline review suggestion to memoize the `mainViewDeepStarCanvasPoints` pipeline in `SkyLensServerless/components/viewer/viewer-shell.tsx` so canvas redraws are not triggered by unnecessary array reference churn.

## Scope
- Analyze correctness and applicability of memoizing `mainViewDeepStarCanvasPoints`.
- Implement memoization at the safest, nearest effective boundary (direct `useMemo` on the derived array, or a clearly justified nearby derivation boundary).
- Keep behavior identical for deep-star visibility, projection, center-lock logic, and label candidate pipelines.
- Update tests as needed to validate that unrelated rerenders do not trigger redundant deep-star canvas redraws.

## Constraints
- Keep changes minimal and focused to the memoization review item.
- Do not introduce unrelated refactors.
- Preserve existing architecture split between canvas-rendered deep stars and interactive DOM markers.

## Acceptance criteria
1. `mainViewDeepStarCanvasPoints` (or the closest effective derivation input used by `MainStarCanvas`) is memoized with correct dependencies.
2. No stale render behavior from incorrect memo dependencies.
3. Existing relevant tests pass and any necessary new/updated tests pass.
4. Build/typecheck pass for `SkyLensServerless`.

## Required execution mode
Run autoloop with:
- `--full-auto-answers`
- pairs: `plan,implement,test`
- no `--max-iterations` flag
