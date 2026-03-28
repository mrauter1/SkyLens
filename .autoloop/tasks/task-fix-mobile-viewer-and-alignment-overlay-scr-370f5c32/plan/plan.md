# Mobile Viewer Scroll Fix Plan

## Scope
- Fix compact/mobile viewer overlay scrolling in [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) so long content remains reachable on short screens.
- Keep the live camera stage and document root non-scrollable while the overlay and compact alignment panel gain their own bounded vertical scroll behavior.
- Update targeted unit and e2e coverage in [`tests/unit/viewer-shell.test.ts`](/workspace/SkyLens/tests/unit/viewer-shell.test.ts) and the affected mobile e2e specs/helpers in [`tests/e2e/demo.spec.ts`](/workspace/SkyLens/tests/e2e/demo.spec.ts), [`tests/e2e/permissions.spec.ts`](/workspace/SkyLens/tests/e2e/permissions.spec.ts), and [`tests/e2e/mobile-overlay.ts`](/workspace/SkyLens/tests/e2e/mobile-overlay.ts) as needed.

## Milestone
### Mobile overlay and alignment reachability
- Change the live-camera compact mobile overlay path from a fully non-scrolling shell to a bounded overlay container with internal vertical scrolling, while preserving the existing document/stage scroll lock controlled by `shouldLockViewerScroll`.
- Give compact overlay content and compact alignment instructions an explicit max-height/overflow strategy so lower controls remain reachable without exposing the underlying stage to scroll or tap-through.
- Preserve existing interaction contracts: `Open viewer` trigger, backdrop close, panel click isolation, alignment-focus transition, and current test IDs.
- Extend automated coverage to assert the new scroll-capable compact path, compact alignment reachability, and unchanged open/close behavior.

## Interfaces And Invariants
- Preserve these selectors unless a test update proves a narrower wrapper change is required:
  - `mobile-viewer-overlay-shell`
  - `mobile-viewer-overlay-scroll-region`
  - `mobile-viewer-overlay`
  - `mobile-viewer-overlay-backdrop`
  - `alignment-instructions-panel`
  - `alignment-start-action`
- `shouldLockViewerScroll` remains the authority for locking `documentElement`, `body`, and the `<main>` stage container. The fix must not move scroll responsibility back to the page/root.
- The compact live-camera overlay remains modal: backdrop closes it, inner panel clicks do not, and the underlying stage stays interaction-isolated while the overlay is open.
- No route, storage, permissions, or alignment-state interfaces change in this task.

## Implementation Notes
- Keep the change local to the existing mobile compact rendering path instead of adding a new overlay abstraction.
- Prefer class/layout adjustments that make the shell fill the viewport and give the panel/content an explicit `max-height` plus `overflow-y-auto`.
- Apply the same bounded-scroll strategy to the compact alignment instructions path so the start/reset/fine-adjust controls remain reachable on short mobile screens.
- Reuse the current test structure and selectors; add assertions around class names/DOM structure only where they directly protect the required behavior.

## Regression Risks And Controls
- Overlay regression risk: changing overflow wrappers can break backdrop click targeting or inner click isolation.
  - Control: retain the existing backdrop/button structure and cover open, inner click, and backdrop close behavior in unit/e2e tests.
- Scroll-lock regression risk: enabling overlay scroll could accidentally re-enable page/stage scrolling in live camera mode.
  - Control: keep `shouldLockViewerScroll` unchanged and assert the compact live path still uses document overflow lock while the overlay owns scrolling.
- Alignment regression risk: compact alignment content may still clip if only the viewer overlay changes.
  - Control: update the compact alignment container itself and add a unit test that verifies the alignment panel remains present in compact mode with reachable action controls.

## Validation
- `npm run test -- tests/unit/viewer-shell.test.ts`
- `npm run test:e2e -- tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts`
- `npm run test`

## Rollback
- Revert the compact mobile overlay/layout changes in `viewer-shell.tsx` if they break modal isolation or stage lock behavior.
- Keep any new tests that reveal the regression, then adjust the overlay structure with a smaller wrapper-only change rather than removing the coverage.
