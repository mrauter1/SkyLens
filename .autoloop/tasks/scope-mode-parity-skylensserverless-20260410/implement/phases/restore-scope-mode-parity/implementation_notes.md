# Implementation Notes

- Task ID: scope-mode-parity-skylensserverless-20260410
- Pair: implement
- Phase ID: restore-scope-mode-parity
- Phase Directory Key: restore-scope-mode-parity
- Phase Title: Restore scope marker and label parity
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `.autoloop/tasks/scope-mode-parity-skylensserverless-20260410/decisions.txt`
- `.autoloop/tasks/scope-mode-parity-skylensserverless-20260410/implement/phases/restore-scope-mode-parity/implementation_notes.md`

## Symbols touched
- `ViewerShell`
- `resolveMarkerEligibleProjectedObjects`
- `scopeProjectedMarkerObjects`
- `scopeVisibleMarkerObjects`
- `scopeInteractiveMarkerObjects`
- `labelObjects`
- `scopeLensObjects`
- `getScopeMarkerSizePx`

## Checklist mapping
- Milestone 1: Replaced the scope bright-only gate with shared marker eligibility resolution for stage and scope paths.
- Milestone 2: Kept stage and scope-lens projected marker collections split, with scope objects reprojected into the lens profile and offset back only for stage-based label/layout consumers.
- Milestone 3: Rebuilt scope center-lock, lens markers, on-object labels, and top-list candidates from scope marker parity objects plus scope deep stars.
- Milestone 4: Added regression coverage for non-bright scope center-lock, scope on-object/top-list parity, and scope-only sizing behavior.

## Assumptions
- Scope parity should match existing normal-view marker eligibility semantics rather than broaden daylight suppression.
- Wide-context stage rendering in scope mode should remain on the wide-stage surface; only lens-driven collections should adopt scope projection and sizing.

## Preserved invariants
- Normal-view marker, label, and deep-star behavior remains unchanged.
- Scope deep stars remain a separate source merged into scope center-lock and label candidate assembly.
- Scope overlay ordering remains wide stage below the lens overlay.

## Intended behavior changes
- Non-bright marker-eligible classes such as aircraft and satellites now participate in scope lens markers, scope center-lock, and scope label/top-list candidates.
- A non-bright scope center-lock winner now receives active lens marker styling.
- Scope lens marker sizing for non-bright objects now follows scope optics/FOV instead of the wide-stage baseline.

## Known non-changes
- No changes to deep-star catalog selection, limiting-magnitude math, or scope settings persistence.
- No visual redesign of the viewer shell or overlay chrome.
- The lens overlay keeps the existing `scope-bright-object-marker` DOM selector for compatibility.

## Expected side effects
- Scope top-list and on-object labels can now surface aircraft/satellite entries when they are in-lens and otherwise eligible.
- Wide-stage markers may still differ from lens markers in scope mode because the stage surface intentionally preserves wide-context optics.

## Validation performed
- `npm test -- tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx` in `SkyLensServerless`

## Deduplication / centralization
- Centralized marker eligibility filtering in `resolveMarkerEligibleProjectedObjects(...)` instead of maintaining separate normal-view and scope-only predicate branches.
