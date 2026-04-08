# Autoloop Task: Fix normal-view deep star visibility + center-lock eligibility (SkyLensServerless)

## Execution mode requirements
- Run with **full_auto answers enabled**.
- Run with **pairs: plan,implement,test**.
- Do **not** set max_iterations.
- Implement only through autoloop; do not require manual coding outside the autoloop run.

## Scope
- Primary code scope: `SkyLensServerless/` subtree.
- Do not modify unrelated root app implementation files unless absolutely required for build/test wiring.

## Problem statement
In SkyLensServerless:
1. Aperture changes in **normal view** appear to have little/no visible effect on deep stars.
2. Center-lock in normal view can lock on deep stars that are not visibly rendered to the user.

Observed root cause direction:
- Deep stars are computed and optics-gated, but in normal view marker composition favors focused deep stars, so aperture-driven emergence is not broadly visible.
- Main-view center-lock candidate pool includes deep stars beyond the active visible/rendered normal-view set.

## Desired behavior
1. In normal view, increasing aperture should visibly increase the set/count of deep stars rendered (subject to existing daylight/horizon/limiting-magnitude gates).
2. Center-lock in normal view should only target stars that are currently visible/rendered to the user in the normal-view scene.
3. Scope-mode deep-star behavior should remain unchanged unless required by correctness.

## Files likely involved
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- Optionally: `SkyLensServerless/tests/unit/projection-camera.test.ts`

## Implementation requirements
- Keep existing selection tie-break ordering logic intact where applicable (angular distance, brightness, stable id).
- Preserve existing settings semantics:
  - main-view deep-stars toggle
  - governor tier logic
  - focused/selected object exceptions where intentional
- Prefer aligning center-lock candidate source with the same effective visible/rendered object set used by normal-view marker rendering.
- Avoid regressions in scope mode and daylight suppression behavior.

## Test requirements
Add or update tests so they verify:
1. **Normal-view aperture emergence**: higher aperture produces more visible deep-star output than default/low aperture in normal view.
2. **Center-lock visibility constraint**: normal-view center-lock does not select deep stars not currently rendered/visible in normal view.
3. **Regression guard**: scope-mode deep-star rendering behavior remains unchanged.

Then run targeted tests and at least one broader verification pass.

Suggested commands:
- `pnpm --dir SkyLensServerless test -- viewer-shell-scope-runtime`
- `pnpm --dir SkyLensServerless test -- projection-camera` (if affected)
- `pnpm --dir SkyLensServerless test`

## Completion criteria
- Code and tests updated with passing results for relevant suites.
- Behavior matches desired outcomes above.
- Changes are limited and well-scoped to SkyLensServerless deep-star/center-lock logic.
