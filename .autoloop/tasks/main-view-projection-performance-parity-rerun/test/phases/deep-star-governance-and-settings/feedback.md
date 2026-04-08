# Test Author ↔ Test Auditor Feedback

- Task ID: main-view-projection-performance-parity-rerun
- Pair: test
- Phase ID: deep-star-governance-and-settings
- Phase Directory Key: deep-star-governance-and-settings
- Phase Title: Main-View Deep-Star Governance
- Scope: phase-local authoritative verifier artifact

- Added/refined deterministic unit coverage for the persisted main-view deep-stars toggle, governor precedence and hysteresis, startup visible-count band, dev diagnostics text, main-view disabled-mode workload cuts, focus-only main-view marker-label behavior, shared B-V marker styling, and an explicit guard that scope-mode deep-star rendering stays unchanged when the main-view toggle is off. Verified with `pnpm exec vitest run tests/unit/scope-optics.test.ts tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-shell.test.ts`.
- `TST-000` | `non-blocking` | No audit findings in this pass. The phase-local strategy matches the changed behavior and shared decisions ledger, the preserved scope-mode invariant is explicitly covered, and the targeted suite reran green (`140` tests).
