# Implement ↔ Code Reviewer Feedback

- Task ID: fix-settings-scroll-lock-and-motion-retry-review
- Pair: implement
- Phase ID: fix-scroll-lock-and-permission-recovery
- Phase Directory Key: fix-scroll-lock-and-permission-recovery
- Phase Title: Coordinate settings scroll locking and restore combined motion retry feedback
- Scope: phase-local authoritative verifier artifact

No blocking or non-blocking findings in this review pass. Verified that scroll-lock ownership is centralized in `ViewerShell`, settings-sheet visibility is tracked per mounted instance, combined camera+motion recovery restores `motionRetryError` on denied motion retries, and the targeted Vitest slice passes.
