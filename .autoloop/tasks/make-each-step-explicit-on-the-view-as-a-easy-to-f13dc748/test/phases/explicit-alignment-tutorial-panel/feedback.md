# Test Author ↔ Test Auditor Feedback

- Task ID: make-each-step-explicit-on-the-view-as-a-easy-to-f13dc748
- Pair: test
- Phase ID: explicit-alignment-tutorial-panel
- Phase Directory Key: explicit-alignment-tutorial-panel
- Phase Title: Explicit alignment tutorial and blockers
- Scope: phase-local authoritative verifier artifact

- Added live-panel regression coverage for the pre-sample blocker path in `tests/unit/viewer-shell.test.ts`, and refreshed the phase strategy with an explicit AC-to-test map covering target-aware copy, blocker/fallback messaging, live nudges/reset wiring, and preserved alignment invariants.
- Added a deterministic `canFixAlignment: false` settings-sheet test to cover the unavailable-in-current-mode blocker branch and confirm the disabled Align state for that path.
- Re-ran the targeted alignment suites after the final coverage pass: `pnpm test -- tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-settings.test.tsx` completed green with 184 passing tests.
- `TST-001` | `blocking` | The changed blocker model in `lib/viewer/alignment-tutorial.ts` has a distinct `canFixAlignment === false` mode-blocker branch, but the updated suite still does not exercise that path in either the live panel or the settings sheet. If that branch stops rendering, regresses copy, or becomes disconnected from the shared helper, the current tests will still pass even though AC-3 covers unavailable alignment actions broadly. Add one deterministic test that renders an alignment surface with `canFixAlignment: false` and asserts the inline mode-blocker notice plus the disabled Align state for that branch.
- `TST-001` | `non-blocking` | Resolved in cycle 2 by the added `canFixAlignment: false` settings-sheet test, which now asserts the unavailable-in-current-mode blocker notice and disabled Align state for the shared mode-blocker branch.
- `TST-000` | `non-blocking` | No remaining audit findings in scope after the added mode-blocker coverage and the green alignment-focused test rerun (`npx vitest run tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`).
- `TST-002` | `non-blocking` | Follow-up audit: the prior `TST-001` gap is now covered by `tests/unit/settings-sheet.test.tsx` via the dedicated `canFixAlignment: false` test that asserts the mode-blocker notice and disabled Align state. No remaining audit findings.
