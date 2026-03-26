# Mobile Overlay E2E Fix Plan

## Scope
- Align the mobile Playwright suite with the intentional collapsed-overlay viewer UX documented in `MOBILE_OVERLAY_E2E_INVESTIGATION_PLAN.md`.
- Update failing e2e flows to expand the mobile overlay before asserting viewer chrome that is hidden by default on mobile.
- Keep runtime mobile UX unchanged unless investigation proves a real functional defect after the overlay is opened.
- Source of truth: immutable request snapshot plus the current run log; there are no later clarifications.

## Current Baseline
- Playwright runs only against the `Pixel 7` project, so all e2e failures are against the mobile viewer contract.
- `components/viewer/viewer-shell.tsx` intentionally renders only the `Open viewer` trigger while collapsed and exposes the rest of the mobile chrome inside `data-testid="mobile-viewer-overlay"` after expansion.
- Existing unit coverage in `tests/unit/viewer-shell.test.ts` already asserts that the mobile overlay is collapsed by default and that blocked-state actions are reachable after expansion.
- The stale assumptions are in `tests/e2e/demo.spec.ts`, `tests/e2e/landing.spec.ts`, and `tests/e2e/permissions.spec.ts`, which currently assert viewer content as if it were visible without opening the overlay.

## Milestone
### Ship one focused Playwright-alignment slice
- Add a small shared e2e helper to expand the mobile viewer overlay only when the overlay container is not already visible.
- Anchor overlay-state setup to the existing stable test ids:
  - `mobile-viewer-overlay-trigger`
  - `mobile-viewer-overlay`
- Update affected e2e specs so hidden mobile chrome is asserted only after the helper expands the overlay.
- Keep semantic assertions for user-facing controls and copy after the overlay is open.
- Run focused viewer-shell unit coverage plus the full Playwright suite to confirm the issue is stale tests rather than a runtime regression.

## Interfaces And Boundaries
- No product interface changes:
  - no route or query-param changes
  - no viewer-state contract changes
  - no settings persistence changes
  - no visual behavior change to the mobile overlay default state
- Internal test interface to add:
  - a small Playwright helper callable from mobile viewer specs that ensures the overlay is open before content assertions
- Expected implementation scope:
  - `tests/e2e/demo.spec.ts`
  - `tests/e2e/landing.spec.ts`
  - `tests/e2e/permissions.spec.ts`
  - one nearby e2e helper file if shared setup reduces duplication cleanly
- Runtime code should stay untouched unless the investigation shows the existing overlay test ids or expansion behavior are insufficient for reliable automation.

## Validation
- Run focused viewer-shell unit coverage that already codifies the mobile collapsed/expanded contract.
- Run `npm run test:e2e` and require all 8 Playwright tests to pass.
- Confirm these invariants through assertions:
  - mobile viewer chrome remains collapsed by default behind the trigger
  - demo banner, settings access, and permission fallback actions are asserted only after overlay expansion
  - desktop-only assumptions are not introduced into the mobile suite

## Compatibility Notes
- The collapsed-by-default mobile overlay is the compatibility baseline and must not be relaxed just to satisfy tests.
- Existing `data-testid` hooks in `ViewerShell` are treated as the preferred automation contract for this slice; semantic role/name checks remain appropriate only after the overlay is open.
- Because Playwright is mobile-only here, no desktop e2e coverage expansion is part of this task.

## Regression Prevention
- Prefer a single helper over repeated inline click/setup logic so overlay-state handling stays consistent across specs.
- Make the helper idempotent: if the overlay is already visible, do nothing rather than assuming the trigger still exists.
- Avoid text-only preconditions for overlay state; use the test ids to verify collapsed vs expanded state explicitly.
- If any assertion still fails after expansion, treat it as a possible product regression and investigate before broadening selectors or weakening checks.

## Risk Register
- R1: Tests may keep depending on trigger text such as `Open viewer`, creating fragile failures on future copy changes.
  - Control: use the existing test ids for overlay trigger/container state setup.
- R2: Inline spec changes without a helper could drift into inconsistent mobile setup across files.
  - Control: centralize overlay expansion in one small shared helper if more than one spec needs it.
- R3: A stale-test assumption could mask a real runtime regression in overlay content availability.
  - Control: verify content after expansion and retain focused unit coverage of the intended mobile behavior.
- R4: Over-correcting by changing runtime UI to satisfy tests would introduce unintended product behavior.
  - Control: keep runtime overlay behavior unchanged unless investigation proves the product no longer satisfies the documented mobile contract.

## Rollback
- Revert only the e2e helper/spec updates if they destabilize automation, keeping the viewer runtime untouched.
- If a runtime change becomes necessary and later proves incorrect, roll back that runtime adjustment separately from the Playwright test cleanup so the intentional mobile UX remains easy to restore.
