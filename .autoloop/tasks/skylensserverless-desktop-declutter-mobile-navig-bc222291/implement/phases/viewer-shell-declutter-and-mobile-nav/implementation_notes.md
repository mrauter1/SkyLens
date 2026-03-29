# Implementation Notes

- Task ID: skylensserverless-desktop-declutter-mobile-navig-bc222291
- Pair: implement
- Phase ID: viewer-shell-declutter-and-mobile-nav
- Phase Directory Key: viewer-shell-declutter-and-mobile-nav
- Phase Title: Desktop declutter, hover parity, and mobile navigation hardening
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/e2e/demo.spec.ts`
- `.autoloop/tasks/skylensserverless-desktop-declutter-mobile-navig-bc222291/decisions.txt`

## Symbols touched
- `ViewerShell`
- `DesktopActionButton`
- `CompactTopBanner`
- desktop viewer/action state: `hoveredObjectId`, `isDesktopViewerPanelOpen`

## Checklist mapping
- Desktop declutter: desktop-only compact top warning stack, compact desktop action row, desktop viewer panel hidden by default.
- Desktop actions: explicit desktop `Open viewer`, `Enable camera`, `Motion`, and `Align` slots wired to existing permission/alignment handlers.
- Desktop hover parity: hover feeds `activeSummaryObject` and desktop detail rendering without replacing explicit selection.
- Mobile navigation hardening: alignment open/focus now explicitly closes conflicting desktop/mobile settings state; unit coverage kept on overlay/alignment flows.
- Tests: updated desktop unit expectations, added desktop hover unit coverage, added desktop viewer-panel Playwright coverage.

## Assumptions
- Existing mobile overlay/alignment tests remain the authoritative regression surface for the mobile navigation bug class in this phase.
- Direct TLE / `corsproxy.io` removal was completed by the earlier direct API phase; this phase did not re-open transport code.

## Preserved invariants
- Route contract and permission sequencing stay unchanged.
- Mobile quick actions, overlay trigger IDs, and alignment-flow test IDs remain intact.
- Click selection still persists independently of center-lock and now independently of hover.
- Mobile warning copy stays inside the existing mobile overlay contract; the new compact warning stack is not shown on mobile.

## Intended behavior changes
- Desktop no longer renders the full content stack by default.
- Desktop warnings are top-positioned and compact.
- Desktop hover exposes object information in the shared summary/detail pipeline.
- Desktop `Align` stays visible but is disabled with a motion-required status when alignment UI cannot actually open.

## Known non-changes
- Mobile overlay body structure remains largely unchanged to limit regression risk.
- Settings-sheet contract and route params were not expanded.

## Expected side effects
- Clicking a marker now opens the desktop viewer panel so selected details are immediately visible on desktop.
- Opening alignment or desktop settings collapses the desktop viewer panel to avoid stacked desktop chrome.

## Validation performed
- `pnpm -C SkyLensServerless exec vitest run tests/unit/viewer-shell.test.ts -t "collapses mobile chrome behind the bottom trigger and restores it when opened|closes mobile overlay on backdrop click without closing from inner panel clicks|routes the mobile align action through the panel before entering alignment focus|keeps Start alignment visible if the mobile viewer overlay is reopened while alignment is open|keeps desktop chrome compact until the viewer panel is explicitly opened|uses hover for desktop summary focus without clearing explicit selection details|disables the desktop Align action when manual pan is active"`
- `pnpm -C SkyLensServerless exec eslint components/viewer/viewer-shell.tsx tests/unit/viewer-shell.test.ts tests/e2e/demo.spec.ts`
- `pnpm -C SkyLensServerless exec playwright install chromium`
- `pnpm -C SkyLensServerless exec playwright test tests/e2e/demo.spec.ts --grep "desktop viewer keeps actions visible and opens the compact viewer panel on demand|mobile overlay keeps lower sections reachable on a short viewport"` failed in the container because Chromium runtime library `libatk-1.0.so.0` is missing.

## Deduplication / centralization
- Reused the existing `activeSummaryObject` / detail-row pipeline for hover rather than introducing a separate desktop hover model.
- Centralized desktop warnings into `topWarningItems` + `CompactTopBanner` instead of repeating banner blocks across the desktop layout.
