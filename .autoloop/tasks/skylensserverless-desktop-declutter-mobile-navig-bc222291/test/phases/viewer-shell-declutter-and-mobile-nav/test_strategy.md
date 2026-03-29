# Test Strategy

- Task ID: skylensserverless-desktop-declutter-mobile-navig-bc222291
- Pair: test
- Phase ID: viewer-shell-declutter-and-mobile-nav
- Phase Directory Key: viewer-shell-declutter-and-mobile-nav
- Phase Title: Desktop declutter, hover parity, and mobile navigation hardening
- Scope: phase-local producer artifact

## Behavior to coverage map
- Desktop declutter / action shell:
  - `tests/unit/viewer-shell.test.ts`
  - Covers compact desktop action row, desktop viewer panel hidden by default, the desktop-only breakpoint gate on `viewer-top-warning-stack`, and the requirement that panel-only desktop copy/status assertions explicitly open the compact viewer panel first.
- Desktop hover parity:
  - `tests/unit/viewer-shell.test.ts`
  - Covers hover-driven summary updates while explicit click selection remains the persistent detail source.
- Desktop align action safety:
  - `tests/unit/viewer-shell.test.ts`
  - Covers the manual-pan edge case where `Align` must stay visible but disabled rather than opening a dead path.
- Mobile overlay/navigation regressions:
  - `tests/unit/viewer-shell.test.ts`
  - Covers overlay open/close behavior, backdrop handling, alignment-panel reopen behavior, and the mobile align routing path.
- Desktop e2e shell reachability:
  - `tests/e2e/demo.spec.ts`
  - Covers visible desktop action slots and opening the compact viewer panel on demand.

## Preserved invariants checked
- Mobile warning copy remains inside the existing overlay contract; the desktop warning stack is desktop-scoped by class contract.
- Desktop pre-start live states still surface startup-blocked viewer copy through the compact desktop panel instead of relying on the old always-open desktop stack.
- Mobile overlay trigger IDs, alignment test IDs, and selected-object detail flow stay intact.
- Hover does not replace explicit selection persistence.

## Edge cases / failure paths
- Manual-pan / denied-motion desktop state disables `Align`.
- Motion-pending and sensor-waiting desktop states remain visible after opening the compact viewer panel during startup and retry flows.
- Persisted manual-observer desktop fallback remains readable from the compact viewer panel when geolocation is denied.
- Hovering a second object after selection updates summary focus without clearing selected detail.
- Short mobile viewport overlay remains scrollable to lower content in existing e2e coverage.

## Stabilization approach
- Use unit tests for breakpoint-contract assertions that JSDOM can validate deterministically via classes and DOM structure.
- Keep pointer-driven hover coverage in unit tests to avoid flaky browser-hover timing.
- Stub `requestAnimationFrame` in the two live startup/recovery cases that only care about permission/state transitions, so those assertions do not inherit unrelated render-loop churn while the live session is active.
- Drive combined camera+motion recovery with an explicit emitted orientation sample rather than assuming the retry path reaches `granted` within a single implicit async flush.

## Known gaps
- Playwright desktop/mobile smoke coverage exists in repo but cannot run in this container until Chromium runtime libraries such as `libatk-1.0.so.0` are available.
