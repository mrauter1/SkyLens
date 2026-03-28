# Test Author ↔ Test Auditor Feedback

- Task ID: fix-settings-scroll-lock-and-motion-retry-review-tty
- Pair: test
- Phase ID: fix-scroll-lock-and-motion-retry
- Phase Directory Key: fix-scroll-lock-and-motion-retry
- Phase Title: Coordinate viewer lock ownership and restore combined motion retry messaging
- Scope: phase-local authoritative verifier artifact

- Added focused coverage in `tests/unit/viewer-shell.test.ts` for settings-open scroll-lock overlap, combined motion denial messaging, and the thrown orientation-retry failure path while camera recovery continues.
- Added focused coverage in `tests/unit/settings-sheet.test.tsx` for open-state callbacks, unmount cleanup, and non-ownership of global overflow styles.

No blocking or non-blocking test-audit findings.
