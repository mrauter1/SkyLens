# Implement ↔ Code Reviewer Feedback

- Task ID: skylensserverless-desktop-declutter-mobile-navig-bc222291
- Pair: implement
- Phase ID: viewer-shell-declutter-and-mobile-nav
- Phase Directory Key: viewer-shell-declutter-and-mobile-nav
- Phase Title: Desktop declutter, hover parity, and mobile navigation hardening
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | `SkyLensServerless/components/viewer/viewer-shell.tsx` (`topWarningItems`, `viewer-top-warning-stack`): the new compact warning stack renders on mobile as well as desktop because the wrapper has no breakpoint gate. On mobile demo and denied-permission routes this adds persistent top-of-screen chrome outside the existing overlay contract, duplicates warning copy already present in the overlay, and risks obscuring the stage on short viewports. That violates the explicit “do not break mobile view” requirement. Minimal fix: scope the new top warning stack to the desktop branch only, or otherwise keep mobile warnings inside the existing overlay surface while preserving the compact top stack on desktop.
- IMP-002 | blocking | `SkyLensServerless/components/viewer/viewer-shell.tsx` (`desktop-align-action`, `openAlignmentExperience`, `shouldShowAlignmentInstructions`): the new desktop `Align` button is enabled whenever `showMobileAlignAction` is true, including manual-pan states. In manual-pan, clicking the button sets `isAlignmentPanelOpen`, but `shouldShowAlignmentInstructions` is hard-gated by `!manualMode` and the `manualMode` cleanup effect immediately closes the panel state, so the required desktop action becomes a dead control. Minimal fix: drive desktop align availability from the same actual-openability contract as the alignment panel (`manualMode`, `canFixAlignment`, `canAlignCalibration`), and disable or retitle the desktop button whenever alignment UI cannot open.
- Re-review C2: `IMP-001` is resolved by gating `viewer-top-warning-stack` to the desktop breakpoint so mobile keeps warning copy inside the existing overlay contract. `IMP-002` is resolved by disabling the desktop `Align` control in manual-pan / non-openable states and covering that path in unit tests. No additional findings in reviewed scope.
