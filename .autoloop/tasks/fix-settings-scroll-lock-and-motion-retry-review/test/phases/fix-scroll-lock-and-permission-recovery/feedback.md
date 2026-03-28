# Test Author ↔ Test Auditor Feedback

- Task ID: fix-settings-scroll-lock-and-motion-retry-review
- Pair: test
- Phase ID: fix-scroll-lock-and-permission-recovery
- Phase Directory Key: fix-scroll-lock-and-permission-recovery
- Phase Title: Coordinate settings scroll locking and restore combined motion retry feedback
- Scope: phase-local authoritative verifier artifact

Added focused regression coverage for shell-owned settings scroll locking, overlap with an already-active viewer lock, combined camera+motion recovery preserving motion-denial messaging, and the `SettingsSheet` unmount cleanup path that clears the parent open-state callback.

No blocking or non-blocking audit findings in this pass. The focused tests cover the requested lock-ownership change, the overlapping-lock regression surface, the combined motion-denial path, the thrown-orientation edge case, and the settings-sheet unmount cleanup path, and the targeted Vitest slice passes.
