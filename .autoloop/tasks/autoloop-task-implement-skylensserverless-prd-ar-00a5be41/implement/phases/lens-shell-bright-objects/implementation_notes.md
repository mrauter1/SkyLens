# Implementation Notes

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: implement
- Phase ID: lens-shell-bright-objects
- Phase Directory Key: lens-shell-bright-objects
- Phase Title: Lens Shell And Bright Scope Pass
- Scope: phase-local producer artifact

## Files changed
- `.autoloop/tasks/autoloop-task-implement-skylensserverless-prd-ar-00a5be41/implement/phases/lens-shell-bright-objects/implementation_notes.md`
- `.autoloop/tasks/autoloop-task-implement-skylensserverless-prd-ar-00a5be41/decisions.txt`

## Symbols touched
- No product-code symbols changed this resume turn.

## Checklist mapping
- Milestone 3 / lens geometry, chrome, vignette, clipping, and click shield: no new edit required; verified existing `ScopeLensOverlay` fix still matches the circular shield requirement from `IMP-002`.
- Milestone 3 / bright-object second projection pass and scope center-lock switching: no new edit required; verified existing `ViewerShell` split between wide-scene state and scope readout precedence still matches `IMP-001`.
- Milestone 6 / targeted validation: reran focused unit coverage for overlay geometry, alignment-focus suppression, scope center-lock precedence, and occlusion DOM order.
- Deferred within this phase: named deep-scope-star precedence and dense tile loading remain out of scope for this phase.

## Assumptions
- Existing wide bright stars remain sufficient for this phase’s “existing bright/named stars” requirement until deep-scope tiles land later.
- The current `ViewerShell` mobile alignment flow remains the authoritative trigger for suppressing the scope lens.

## Preserved invariants
- Wide markers, labels, constellations, and selection behavior stay unchanged outside the lens.
- Scope controls remain hidden when the viewer is blocked or inactive.
- Direct pointer selection inside the lens remains unsupported.

## Intended behavior changes
- None this resume turn; the previously landed behavior remains in place.

## Known non-changes
- No dense scope tile loading, deep-star canvas, or named deep-star detail path yet.
- No new route, persistence namespace, or direct scope-object click behavior.

## Expected side effects
- No additional side effects beyond the already-landed phase behavior.

## Validation performed
- `npm test -- --run tests/unit/scope-lens-overlay.test.tsx tests/unit/viewer-shell.test.ts`
- `npm test -- --run tests/unit/viewer-shell-celestial.test.ts -t "switches center-lock to scope bright objects when scope mode is enabled|renders the scope overlay after wide lines, markers, and labels for lens occlusion ordering"`
- `npx eslint components/viewer/viewer-shell.tsx components/viewer/scope-lens-overlay.tsx tests/unit/scope-lens-overlay.test.tsx tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell.test.ts`
- Validation result: targeted tests passed with no code changes required.
- Lint note: `components/viewer/viewer-shell.tsx` still reports five pre-existing `react-hooks/exhaustive-deps` warnings at lines `1696`, `2119`, `2146`, `2321`, and `2491`; no new warnings were introduced by this turn.

## Deduplication / centralization
- No new deduplication or centralization changes this resume turn.
