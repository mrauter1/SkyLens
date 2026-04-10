# Implementation Notes

- Task ID: scope-mode-review-fixes-20260410
- Pair: implement
- Phase ID: scope-mode-parity-regression-fixes
- Phase Directory Key: scope-mode-parity-regression-fixes
- Phase Title: Restore Scope-Mode Wide-Stage Parity
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`

## Symbols touched
- `ViewerShell`
- `resolveInteractionSummaryObject`
- scope-mode stage marker rendering, highlight, and label focus inputs

## Checklist mapping
- Plan item 1: restored scope-mode stage marker ownership to the wide-stage marker set, wide-stage FOV sizing baseline, and wide-scene center-lock highlight inputs.
- Plan item 2: routed selected and hovered summary lookup through explicit interaction-surface state so active motion-affordance coordinates stay on the owning marker projection surface.
- Plan item 3: updated scope runtime and celestial regressions for stage-vs-lens sizing, outside-lens stage visibility, wide-stage highlight ownership, and motion-affordance alignment.
- Plan item 4: no code or test change required in root settings; the existing disabled-scope aperture clamp expectation already matches the authoritative decision.

## Assumptions
- Disabled-scope aperture normalization to `100mm` remains intended behavior unless later clarified otherwise.

## Preserved invariants
- `scope-bright-object-marker` selector compatibility is unchanged.
- Scope lens overlay sizing and highlight behavior remain scope-specific.
- Scope-mode center-lock chip and centered-object panel remain driven by the scope winner.

## Intended behavior changes
- Scope mode stage markers now continue to render and interact from the full wide-stage eligible set, including objects outside the lens.
- Scope mode stage marker size and stage-rendered highlight state stay on the wide-stage baseline while the lens overlay remains magnified.
- Selected and hovered motion-affordance coordinates stay aligned with the projection surface that owns the active interaction target.

## Known non-changes
- No settings normalization code changed.
- No selector rename or storage-schema change was introduced.
- No broader viewer-shell refactor was introduced beyond the reviewed regression seam.

## Expected side effects
- Stage-rendered top-list and on-object highlight styling in scope mode now follows the wide-scene center-lock owner.

## Validation performed
- `./node_modules/.bin/vitest --config vitest.config.ts run tests/unit/viewer-settings.test.tsx --maxWorkers 1`
- `../node_modules/.bin/vitest --config vitest.config.ts run tests/unit/viewer-shell-scope-runtime.test.tsx -t "keeps stage marker sizing on the wide baseline while scope lens markers stay magnified" --maxWorkers 1`
- `../node_modules/.bin/vitest --config vitest.config.ts run tests/unit/viewer-shell-celestial.test.ts -t "keeps wide-stage markers visible and clickable outside the scope lens in scope mode|keeps stage marker highlight ownership on the wide-scene center lock in scope mode|keeps motion-affordance coordinates aligned with the clicked stage marker in scope mode" --maxWorkers 1`

## Open issues
- A wholesale rerun of the entire `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx` file still shows unrelated pre-existing instability outside the touched regression coverage, so validation stayed focused on the directly affected assertions.
