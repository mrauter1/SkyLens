# Implementation Notes

- Task ID: autoloop-task-implement-main-view-hybrid-canvas-70d5075e
- Pair: implement
- Phase ID: hybrid-regression-validation
- Phase Directory Key: hybrid-regression-validation
- Phase Title: Rebaseline tests around the hybrid main-view contract
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/tests/unit/main-star-canvas.test.tsx` (validated existing coverage only; no new edits in this phase)
- `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx` (validated existing coverage only; no new edits in this phase)
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx` (validated existing coverage only; no new edits in this phase)
- `SkyLensServerless/tests/unit/viewer-shell.test.ts` (validated existing coverage only; no new edits in this phase)
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts` (validated existing coverage only; no new edits in this phase)
- `SkyLensServerless/tests/unit/viewer-settings.test.tsx` (validated existing coverage only; no new edits in this phase)
- `.autoloop/tasks/autoloop-task-implement-main-view-hybrid-canvas-70d5075e/implement/phases/hybrid-regression-validation/implementation_notes.md`

## Symbols touched
- No product-code symbols changed in this phase.
- Validation covered `MainStarCanvas`, `StarPointCanvas`, `ScopeStarCanvas`, `ViewerShell`, and persisted viewer-settings readers/writers through existing unit suites.

## Checklist mapping
- AC-1: confirmed existing `main-star-canvas` and shared star-canvas tests cover fill count, B-V parity, alpha clamp, radius clamp, and DPR sizing.
- AC-2: confirmed `viewer-shell-scope-runtime.test.tsx` asserts non-scope deep stars stay in center-lock and label flows while remaining absent from interactive marker DOM.
- AC-3: confirmed scope runtime coverage still exercises unchanged `ScopeLensOverlay` and `ScopeStarCanvas` behavior.
- AC-4: ran the requested targeted suites and the full `SkyLensServerless` Vitest suite successfully.

## Assumptions
- The prior `main-view-canvas-runtime` phase already implemented the approved runtime behavior, so this phase focused on regression validation and test rebaseline only.

## Preserved invariants
- Non-scope deep stars remain canvas-only and do not re-enter interactive DOM markers.
- Deep stars still participate in non-scope center-lock and label candidate pipelines.
- Scope mode lens rendering and deep-star canvas behavior remain unchanged.
- Existing bright-object interaction and accessibility semantics remain DOM-based.

## Intended behavior changes
- No additional behavior changes were introduced in this phase.

## Known non-changes
- No runtime code, settings schema, or rendering contracts were changed in this phase.
- No new tests were required beyond the already-landed hybrid coverage from the prior implementation phase.

## Expected side effects
- None beyond stronger confidence that the previously implemented hybrid contract holds across targeted and full-suite coverage.

## Validation performed
- `npm test -- tests/unit/main-star-canvas.test.tsx tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-settings.test.tsx`
- Result: 6 test files passed, 171 tests passed.
- `npm test`
- Result: 38 test files passed, 388 tests passed.

## Deduplication / centralization
- No new deduplication or centralization changes were made in this phase.
