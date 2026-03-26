# Implementation Notes

- Task ID: mobile-overlay-e2e-fix
- Pair: implement
- Phase ID: align-mobile-playwright-overlay-state
- Phase Directory Key: align-mobile-playwright-overlay-state
- Phase Title: Align mobile Playwright specs with collapsed overlay behavior
- Scope: phase-local producer artifact

## Files changed
- `tests/e2e/mobile-overlay.ts`
- `tests/e2e/demo.spec.ts`
- `tests/e2e/landing.spec.ts`
- `tests/e2e/permissions.spec.ts`

## Symbols touched
- `ensureMobileViewerOverlayOpen`
- demo e2e assertions and settings persistence flow
- landing e2e demo-entry assertion flow
- permissions e2e blocked and fallback assertion flows

## Checklist mapping
- Add shared mobile overlay helper before hidden-chrome assertions: done via `tests/e2e/mobile-overlay.ts`
- Update demo flow: done
- Update landing flow: done
- Update permissions flow: done
- Validate focused unit coverage and full Playwright suite: done

## Assumptions
- The missing session JSON path in the run preamble was an artifact-path issue; other injected authoritative artifacts remained the source of truth.

## Preserved invariants
- Mobile viewer chrome remains collapsed by default in runtime code.
- Existing viewer-shell runtime behavior and test ids remain unchanged.
- Desktop e2e scope was not expanded.

## Intended behavior changes
- Mobile Playwright specs now explicitly open the viewer overlay before asserting viewer chrome that is hidden while collapsed.
- After opening the overlay, affected specs assert against the mobile overlay container instead of ambiguous page-wide duplicate text.

## Known non-changes
- No runtime viewer-shell UX changes.
- No new desktop assertions.
- No changes to unit-test expectations beyond re-validation.

## Expected side effects
- E2E setup is consistent across mobile viewer specs.
- Demo settings persistence uses keyboard activation on the focused checkbox to avoid stage hit-testing interference during automation.

## Validation performed
- `npm test -- --run tests/unit/viewer-shell.test.ts` ✅
- `npm run test:e2e` ✅ (8 passed)
- Local environment setup required `npm install` and `npx playwright install --with-deps chromium` before Playwright could run in this workspace.

## Deduplication / centralization
- Centralized mobile overlay expansion in one idempotent helper shared by demo, landing, and permissions specs.
