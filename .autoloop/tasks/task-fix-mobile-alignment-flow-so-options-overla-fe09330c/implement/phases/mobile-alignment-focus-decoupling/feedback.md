# Implement ↔ Code Reviewer Feedback

- Task ID: task-fix-mobile-alignment-flow-so-options-overla-fe09330c
- Pair: implement
- Phase ID: mobile-alignment-focus-decoupling
- Phase Directory Key: mobile-alignment-focus-decoupling
- Phase Title: Decouple mobile alignment options from active crosshair focus
- Scope: phase-local authoritative verifier artifact

- IMP-001 `blocking` `components/viewer/viewer-shell.tsx` mobile overlay and quick-action alignment panel branches: when the alignment panel is open in mobile quick actions, the `Open viewer` button is still available. If the user taps it, the overlay branch renders `AlignmentInstructionsPanel` with `showStartAlignmentAction={false}`, so the required `Start alignment` CTA disappears even though the align panel remains open. That contradicts AC-1 and the recorded decision that the mobile align view should always show a visible Start alignment control while the panel is open. Minimal fix: either hide the overlay trigger while `isAlignmentPanelOpen` is true, or pass the same start-alignment props into the overlay-rendered mobile panel as the compact quick-action panel, preferably by centralizing the shared mobile panel props so both render sites stay aligned.

Re-review note: IMP-001 is resolved in the current implementation. The mobile alignment panel now reuses the same start-alignment props in the compact quick-action panel and both mobile overlay shells, and the focused unit suite covers reopening the viewer overlay while alignment is already open. No remaining findings in scoped review.
