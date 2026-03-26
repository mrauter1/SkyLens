# Implementation Notes

- Task ID: address-review-feedback-for-mobile-overlay-close-3de5f7db
- Pair: implement
- Phase ID: mobile-overlay-dismissal
- Phase Directory Key: mobile-overlay-dismissal
- Phase Title: Finalize mobile overlay dismissal and viewport safety
- Scope: phase-local producer artifact
- Files changed: `components/viewer/viewer-shell.tsx`; `tests/unit/viewer-shell.test.ts`; `tests/e2e/demo.spec.ts`; `.autoloop/tasks/address-review-feedback-for-mobile-overlay-close-3de5f7db/decisions.txt`
- Symbols touched: `ViewerShell`; mobile overlay markup/classes; mobile overlay dismissal test; demo mobile overlay Playwright coverage
- Checklist mapping: Milestone 1 completed for collapsed-by-default trigger wiring, backdrop dismissal, inner-panel click isolation, iOS-safe bounded sizing, and focused unit/mobile e2e coverage
- Assumptions: the active phase is limited to mobile overlay dismissal/sizing and does not reopen the separate motion-recovery or `likelyVisibleOnly` slices in later phases
- Preserved invariants: desktop overlay composition unchanged; mobile overlay still opens from the existing trigger; blocked-state retry/demo actions remain inside the expanded sheet; no route/state/storage contract changes
- Intended behavior changes: the mobile sheet now derives its usable height from a safe-area padded fixed wrapper so top controls stay reachable on short iOS viewports; Playwright now proves the sheet stays open for inner-panel interaction and closes from the backdrop
- Known non-changes: no changes to motion recovery UX, viewer settings defaults, desktop header/content layout, or permission-state logic
- Expected side effects: the expanded mobile sheet has explicit top breathing room equal to the top safe-area inset plus `1rem`
- Validation performed: targeted review of `viewer-shell` mobile overlay markup and adjacent tests; `npm ci`; `npx vitest run tests/unit/viewer-shell.test.ts` (pass); `npm run test` (pass, 17 files / 102 tests); `npm run lint` (pass); `npx playwright install chromium`; `npx playwright test tests/e2e/demo.spec.ts --project=chromium` remains blocked by missing system library `libatk-1.0.so.0` in the container
- Deduplication / centralization: safe-viewport bounding stays local to the existing mobile overlay wrapper instead of adding a new sizing helper or overlay abstraction
