# Test Strategy

- Task ID: mobile-overlay-e2e-fix
- Pair: test
- Phase ID: align-mobile-playwright-overlay-state
- Phase Directory Key: align-mobile-playwright-overlay-state
- Phase Title: Align mobile Playwright specs with collapsed overlay behavior
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Collapsed-by-default mobile viewer invariant:
  - `tests/unit/viewer-shell.test.ts` covers the closed mobile overlay trigger state, overlay open/close behavior, and blocked-state actions remaining reachable after expansion.
- Shared mobile overlay setup:
  - `tests/e2e/mobile-overlay.ts` centralizes idempotent overlay opening via `mobile-viewer-overlay-trigger` and `mobile-viewer-overlay`.
- Demo flow:
  - `tests/e2e/demo.spec.ts` opens the mobile overlay before asserting the demo banner and selected-object detail rows.
  - `tests/e2e/demo.spec.ts` reopens the overlay after reload and verifies settings persistence for the `Planes` toggle through the mobile settings dialog.
- Landing flow:
  - `tests/e2e/landing.spec.ts` follows the demo entry from `/` into `/view?entry=demo`, then opens the mobile overlay before asserting demo-mode chrome.
- Permissions and fallback flows:
  - `tests/e2e/permissions.spec.ts` opens the mobile overlay before asserting the location-denied blocked shell, bare `/view`, partial live payload, non-camera fallback, and manual-pan fallback states.

## Preserved invariants checked
- The runtime mobile overlay remains collapsed by default until explicitly opened.
- Mobile hidden chrome is asserted only after overlay expansion.
- Desktop coverage scope remains unchanged.

## Edge cases and failure paths
- Blocked-state actions remain reachable after overlay expansion.
- Partial permission payloads still remain blocked until a verified state is present.
- Demo settings persistence is stabilized with keyboard activation on the focused checkbox to avoid stage hit-testing interference during automation.

## Known gaps
- No dedicated e2e case calls `ensureMobileViewerOverlayOpen` twice in the same already-open state; idempotency is covered by helper logic review rather than a standalone regression test.
- Playwright execution depends on local browser/system dependency setup in the workspace.

## Validation
- `npm test -- --run tests/unit/viewer-shell.test.ts`
- `npm run test:e2e`
