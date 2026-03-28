# Test Strategy

- Task ID: task-fix-mobile-viewer-and-alignment-overlay-scr-370f5c32
- Pair: test
- Phase ID: mobile-overlay-scroll-fix
- Phase Directory Key: mobile-overlay-scroll-fix
- Phase Title: Fix compact mobile overlay and alignment scrolling
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-1 compact live-camera overlay scroll ownership:
  - `tests/unit/viewer-shell.test.ts`
  - Verifies compact live mode keeps `mobile-viewer-overlay-shell`, applies bounded overlay max-height, uses internal `mobile-viewer-overlay-compact-content` scrolling classes, and leaves `documentElement`/`body` overflow locked.
- AC-2 compact alignment reachability:
  - `tests/unit/viewer-shell.test.ts`
  - Verifies the compact mobile alignment panel uses bounded internal scrolling and still exposes `alignment-start-action`.
  - `tests/e2e/permissions.spec.ts`
  - Verifies a short viewport can scroll the compact alignment panel far enough to reach the lowest control (`Nudge down`).
- AC-3 preserved trigger/backdrop/isolation behavior:
  - `tests/unit/viewer-shell.test.ts`
  - Existing demo-path backdrop-close test remains.
  - Added live compact-path backdrop-close coverage to ensure the new compact scroll branch still closes from `mobile-viewer-overlay-backdrop` while stage scroll lock remains active.
  - `tests/e2e/demo.spec.ts`
  - Verifies mobile overlay still opens from the trigger, ignores inner panel clicks, and closes from an uncovered backdrop hit area.
- AC-4 focused regression coverage:
  - `tests/e2e/demo.spec.ts`
  - Verifies a short viewport can scroll the mobile overlay far enough to reach the lower `Privacy reassurance` section.

## Preserved invariants checked
- Existing selectors remain in use:
  - `mobile-viewer-overlay-shell`
  - `mobile-viewer-overlay-scroll-region`
  - `mobile-viewer-overlay`
  - `mobile-viewer-overlay-backdrop`
  - `alignment-instructions-panel`
  - `alignment-start-action`
- Compact live-camera mode keeps document/body overflow locked after overlay open and after backdrop close.
- Overlay inner content remains interactive without treating an interior click as a backdrop dismissal.

## Edge cases and failure paths
- Compact live overlay close behavior is exercised on the same branch that now owns internal scrolling.
- Short-viewport mobile cases are exercised in Playwright by shrinking the viewport and asserting actual scrollable overflow before checking bottom controls.

## Flake risks and stabilization
- Mobile e2e backdrop clicks target an uncovered corner of the backdrop so the click is not intercepted by the modal card.
- Demo marker interaction closes the overlay before selecting the marker, then reopens the overlay, avoiding flaky pointer interception by mobile chrome.
- Alignment panel e2e scopes to the mobile quick-actions panel to avoid strict-mode ambiguity with the desktop copy in the DOM.

## Validation status
- Re-ran `npm run test -- tests/unit/viewer-shell.test.ts` after adding the compact-path backdrop-close test.
- Existing phase validation already covered `npm run test:e2e -- tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts` and `npm run test`.

## Known gaps
- No additional desktop assertions were added because desktop layout is out of scope for this phase.
