# Autoloop Task: Implement Main-View Hybrid Canvas/DOM Renderer in SkyLensServerless

## Goal
Implement the approved hybrid rendering architecture in `SkyLensServerless`:
- Use **canvas** for dense/deep star field rendering in **normal (non-scope) mode**.
- Keep **DOM** rendering only for interactive/selectable objects and label surfaces.
- Preserve all existing center-lock, label, optics, selection/hover, and accessibility semantics.

## Context
Start from the latest plan in:
- `SkyLensServerless/CANVAS_HYBRID_MAIN_VIEW_PLAN.md`

Address any unresolved review concerns from the prior planning PR by fully implementing and validating the runtime change.

## Execution mode requirements
- Run with pairs: `plan,implement,test`.
- Perform work in plan/implement/test pairs and complete all three.
- Do not add arbitrary scope outside this feature.
- Minimize risk of regressions.

## Required implementation scope
1. Implement a non-scope canvas rendering path for deep stars in main view.
2. Ensure deep stars are removed from non-scope interactive DOM markers.
3. Preserve deep-star participation in center-lock and label candidate pipelines.
4. Keep scope mode lens/canvas behavior unchanged.
5. Maintain visual parity for B-V color mapping and star alpha/radius semantics.

## Suggested file targets
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/components/viewer/main-star-canvas.tsx` (new) OR a shared reusable canvas primitive
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx` (only if refactoring to shared primitive)
- Relevant tests under `SkyLensServerless/tests/unit/*`

## Regression requirements
Do not regress:
- Center-lock ranking behavior.
- Label mode behavior (`center_only`, `on_objects`, `top_list`).
- Selection/hover/detail card behavior for interactive objects.
- Scope mode behavior and lens overlay rendering.
- Accessibility semantics for interactive markers.

## Testing requirements
At minimum run and pass targeted tests that cover:
- canvas star rendering behavior,
- viewer-shell scope runtime behavior,
- viewer-shell rendering/interaction behavior,
- celestial/viewer settings regressions relevant to this change.

Then run full project tests for `SkyLensServerless` if feasible.

## Deliverables
1. Implemented code changes.
2. Updated/added tests with passing results.
3. Clear summary of changed files and why.
4. Any residual risks or follow-ups explicitly listed.
