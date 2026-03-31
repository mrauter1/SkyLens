# Test Strategy

- Task ID: skylensserverless-ux-implementation
- Pair: test
- Phase ID: finalize-ux-contract
- Phase Directory Key: finalize-ux-contract
- Phase Title: Finalize and verify the SkyLensServerless UX contract
- Scope: phase-local producer artifact

## Behavior-to-Coverage Map

- AC-1 Package bootstrap and authoritative validation
  - Commands run from `/workspace/SkyLens/SkyLensServerless`:
    - `pnpm install --frozen-lockfile`
    - `./node_modules/.bin/playwright install chromium`
    - `./node_modules/.bin/playwright install-deps chromium`
    - `./node_modules/.bin/vitest run tests/unit/settings-sheet.test.tsx tests/unit/alignment-tutorial.test.ts tests/unit/viewer-shell-resolvers.test.ts`
    - `./node_modules/.bin/vitest run tests/unit/viewer-shell.test.ts`
    - `./node_modules/.bin/playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts tests/e2e/landing.spec.ts --project=chromium`
  - Covers package-local runner availability plus reproducible unit/e2e execution in the authoritative app tree.

- AC-2 Compact motion-warning visibility with one primary banner
  - `tests/unit/viewer-shell-resolvers.test.ts`
  - Resolver coverage checks:
    - actionable banner priority stays deterministic
    - `compactNotice` remains `null` when the motion banner itself is primary
    - `awaiting-orientation` stays visible as a separate compact notice when `camera-disabled` becomes primary
    - compact notice stays distinct from the primary banner id

- AC-3 Alignment opener inference and focus restoration
  - `tests/unit/viewer-shell.test.ts`
  - `tests/e2e/permissions.spec.ts`
  - Covers:
    - backdrop close restores to mobile Align
    - stale desktop focus does not hijack a mobile alignment open/close cycle
    - hidden mobile restore targets fall back to the next visible control
    - opener-unmount fallback and reopened mobile-settings fallback remain intact
    - end-to-end alignment backdrop close still restores focus to Align

- AC-4 Focus-trap and restore filtering for hidden/non-focusable nodes
  - `tests/unit/viewer-shell.test.ts`
  - `tests/unit/settings-sheet.test.tsx`
  - Covers:
    - hidden restore targets are skipped during alignment close
    - hidden tab stops are excluded from the mobile overlay tab loop
    - existing settings-sheet focus restore and dismissal behavior remain unchanged

- AC-5 Preserved outside-click / Escape overlay behavior and mobile stability
  - `tests/unit/viewer-shell.test.ts`
  - `tests/e2e/demo.spec.ts`
  - `tests/e2e/permissions.spec.ts`
  - Covers:
    - viewer and alignment backdrops still close the correct overlay
    - Escape close behavior and focus restoration remain intact
    - compact mobile overlays still keep lower content reachable on short viewports
    - desktop viewer controls and landing/demo entry flows remain stable after the scoped viewer-shell changes

## Preserved Invariants Checked

- Stable selector contract remains intact for `mobile-viewer-overlay*`, `mobile-alignment-overlay*`, `settings-sheet-*`, `alignment-start-action`, `viewer-top-warning-stack`, and `desktop-open-viewer-action`.
- One primary actionable banner remains the default on viewer surfaces; compact motion copy augments rather than replaces that contract.
- Outside-click and Escape dismissal policies remain unchanged for settings and viewer-owned overlays.

## Edge Cases and Failure Paths

- Stale desktop focus before a mobile alignment tap.
- Hidden opener / restore targets after an overlay opens.
- Hidden focusable nodes appended inside the active mobile overlay panel.
- Actionable non-motion banners coexisting with motion-pending copy in the resolver.

## Stabilization Notes

- Resolver assertions stay purely data-driven to avoid UI timing on the compact-warning contract.
- DOM-level focus tests use explicit `visibility: hidden` targets and direct keyboard events so the shared focusability predicate is exercised deterministically.
- Full authoritative validation was rerun from `/workspace/SkyLens/SkyLensServerless` after Chromium assets and runtime libraries were provisioned.

## Known Gaps

- No new product-path gaps identified in this phase.
