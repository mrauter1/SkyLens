# Test Author ↔ Test Auditor Feedback

- Task ID: skylensserverless-ux-implementation
- Pair: test
- Phase ID: overlay-foundation
- Phase Directory Key: overlay-foundation
- Phase Title: Overlay foundation and dismissal policy
- Scope: phase-local authoritative verifier artifact

- Added the phase behavior-to-test coverage map in `test_strategy.md`, including preserved selectors, edge cases, and the known Playwright environment gap.
- Strengthened `tests/unit/viewer-shell.test.ts` so explicit alignment focus now asserts the dismissible alignment shell/backdrop are absent, directly encoding AC-3.
- TST-001 `non-blocking` [tests/unit/settings-sheet.test.tsx, tests/unit/viewer-shell.test.ts, test_strategy.md]: Re-audit confirms the phase-critical coverage is in place for AC-1 through AC-4, including backdrop/Escape dismissal, same-surface focus restore fallbacks, and the guarded alignment-focus path that removes the dismissible sheet/backdrop entirely. The focused unit rerun passed cleanly. The only remaining gap is the already-documented environment limitation on Playwright browser execution (`libatk-1.0.so.0` missing), which does not block this phase’s test audit.
