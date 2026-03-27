# Implement ↔ Code Reviewer Feedback

- Task ID: implement-alignment-target-diagnosis-and-fix-pla-29e6230a
- Pair: implement
- Phase ID: align-target-default-and-override-fix
- Phase Directory Key: align-target-default-and-override-fix
- Phase Title: Fix alignment target selection defaults and override behavior
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | [components/viewer/viewer-shell.tsx] `alignmentTargetPreference` still mounts as `'sun'` and only switches to the visibility heuristic inside a `useEffect`. In scenes where Moon should be the default target (Moon-only, Moon higher than Sun, or night fallback with neither body visible), the first painted frame can still show the Sun-selected state and Sun-based instructions before the effect corrects it. That contradicts AC-2's "initial selected alignment target" requirement and leaves the new tests unable to catch the regression because they only assert after effect flushing. Minimal fix: make the effective default preference synchronous in render until a manual override exists, or otherwise initialize the state from the heuristic before first paint, then add a test that inspects the initial render without relying on post-effect updates.
- IMP-002 | non-blocking | Re-review verified that `ViewerShell` now derives the effective alignment target synchronously from the heuristic until a manual override exists, and the updated viewer-shell tests assert the first `SettingsSheet` render props for Moon-default cases. No additional findings in this review pass.
