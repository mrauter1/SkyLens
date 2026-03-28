# Implement ↔ Code Reviewer Feedback

- Task ID: task-desktop-declutter-mobile-safe-navigation-an-94bfedd9
- Pair: implement
- Phase ID: simplify-viewer-shell
- Phase Directory Key: simplify-viewer-shell
- Phase Title: Simplify shared viewer chrome
- Scope: phase-local authoritative verifier artifact

- IMP-001 `blocking` [components/viewer/viewer-shell.tsx]: `openAlignmentExperience()` now always sets `isDesktopOverlayOpen(true)`, but `closeAlignmentExperience()` never clears that desktop-only flag. On mobile live flows without an active camera-stage scroll lock, tapping `Align` and then closing the alignment panel leaves the hidden desktop overlay state stuck on, so `shouldLockViewerScroll` keeps the document locked even though no overlay is visible. That regresses the mobile navigation this task explicitly needed to preserve/fix. Minimal fix: keep desktop overlay state out of the shared mobile alignment path (for example, open it only from the desktop action-row handler), or clear `isDesktopOverlayOpen` from every mobile alignment exit path in the same local state owner.
