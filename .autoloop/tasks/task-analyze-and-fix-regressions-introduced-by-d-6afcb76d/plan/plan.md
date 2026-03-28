# Regression Recovery Plan

## Objective
Analyze the regressions introduced by `daacca7` ("Simplify desktop viewer shell and top warning rail"), repair mobile and desktop behavior without undoing the declutter goals, and validate the impacted unit/e2e paths.

## Confirmed Baseline
- The regression surface is concentrated in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx), plus targeted viewer shell unit tests and mobile overlay/permissions e2e specs.
- `npx vitest run tests/unit/viewer-shell.test.ts` passes (`59` tests).
- `npx vitest run tests/unit/viewer-shell-celestial.test.ts` passes (`33` tests).
- `npx playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts` fails before app code runs because Playwright Chromium is not installed in this environment.
- The active browser regression slice is [tests/e2e/demo.spec.ts](/workspace/SkyLens/tests/e2e/demo.spec.ts), [tests/e2e/permissions.spec.ts](/workspace/SkyLens/tests/e2e/permissions.spec.ts), and the shared helper [tests/e2e/mobile-overlay.ts](/workspace/SkyLens/tests/e2e/mobile-overlay.ts).

## Confirmed Root Causes To Carry Into Implementation
1. The desktop declutter PR moved desktop detail/recovery content behind the shared desktop overlay instead of leaving it ambient in the base shell. Any test or behavior check that still expects that content without opening the overlay is now asserting the wrong contract.
   Verification: `daacca7` moved desktop assertions in unit tests to open the overlay first, and the current unit suites pass with that pattern.
2. `openAlignmentExperience` originally set `isDesktopOverlayOpen(true)` for all breakpoints while viewer scroll lock depended on `isDesktopOverlayOpen`. That allowed desktop overlay state to leak into mobile alignment/open-viewer flows and could latch desktop-style scroll locking on mobile.
   Verification: the parent version of [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx) before `daacca7` always opened the desktop overlay from `openAlignmentExperience`; the current file now gates that state with `viewport.width >= 640`, and the targeted mobile scroll-lock unit test covers the regression.
3. The desktop overlay is now mounted continuously and hidden with `aria-hidden`, opacity, and pointer-event gating instead of conditional unmounting. DOM-existence checks are no longer a reliable proxy for "desktop overlay is closed."
   Verification: current desktop overlay markup is always rendered in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx); unit helpers were updated to open the overlay explicitly before asserting shared content.

## Implementation Milestones
### Milestone 1: Reconfirm state ownership and breakpoint invariants
- Audit every code path that opens or closes `isDesktopOverlayOpen`, `isMobileOverlayOpen`, `isAlignmentPanelOpen`, and `isMobileAlignmentFocusActive`.
- Keep desktop overlay state desktop-only.
- Confirm viewer scroll lock follows active live camera, active mobile alignment focus, open settings, and an actually open desktop overlay path only.

### Milestone 2: Repair behavior without undoing declutter
- Fix any remaining mobile navigation, overlay, alignment, or scroll-lock regressions in [components/viewer/viewer-shell.tsx](/workspace/SkyLens/components/viewer/viewer-shell.tsx).
- Preserve the desktop declutter contract:
  - top warning rail remains compact and top-fixed
  - desktop primary actions remain `Open Viewer`, `Enable Camera`, `Motion`, `Align`
  - detailed desktop recovery/snapshot content stays in the shared desktop overlay
- Keep mobile quick actions, overlay open/close behavior, and alignment focus transitions intact.
- Preserve the mobile browser contracts already encoded by e2e coverage:
  - `mobile-viewer-overlay-trigger` opens the overlay
  - the mobile overlay closes from the backdrop path, not incidental interior taps
  - short-viewport overlay and alignment panels remain scrollable to their lowest controls
  - permission fallback states remain reachable through the mobile overlay

### Milestone 3: Harmonize tests to the actual contract
- Update tests only where the behavior intentionally changed because the content moved behind the desktop overlay.
- Add or keep unit coverage for:
  - mobile alignment open/close and repeated alignment
  - mobile scroll-lock isolation from desktop overlay state
  - desktop action-row and shared-overlay behavior
- Validate e2e mobile overlay and permissions flows after the Playwright browser dependency is available.

## Interface / Behavior Invariants
- Desktop shell (`sm` and up):
  - action row is visible with `Open Viewer`, `Enable Camera`, `Motion`, `Align`
  - warning rail stays at the top of the screen
  - shared desktop overlay contains viewer snapshot, recovery, and privacy detail
- Mobile shell (below `sm`):
  - `mobile-viewer-overlay-trigger` and `mobile-align-action` remain available whenever alignment focus is not active
  - mobile alignment focus hides overlay chrome until the user aligns or exits the flow
  - mobile flows must not set or depend on desktop overlay visibility
- Scroll locking:
  - live camera stage can lock the viewer
  - settings sheets can lock the viewer
  - mobile alignment focus can lock the viewer
  - desktop overlay lock must not leak into mobile-only flows

## Compatibility Notes
- No public API, route format, persisted settings schema, or CLI behavior should change.
- Stable test selectors should be preserved where possible; update assertions before renaming selectors.
- Test intent must distinguish "overlay is closed" from "overlay content moved into a hidden mounted shell."

## Validation Plan
- Unit:
  - `npx vitest run tests/unit/viewer-shell.test.ts`
  - `npx vitest run tests/unit/viewer-shell-celestial.test.ts`
- E2E:
  - Install browser binaries with `npx playwright install chromium` if Chromium is missing
  - Run `npx playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts`
  - Use `tests/e2e/mobile-overlay.ts` helper behavior as part of the contract check for mobile overlay trigger/open state
- If e2e remains blocked, report the exact environment blocker separately from app regressions.

## Risk Register
- Risk: desktop and mobile overlay states drift again because breakpoint logic lives inside action handlers rather than a single invariant.
  Mitigation: inspect every setter path and keep regression tests focused on state ownership.
- Risk: tests mask real regressions by adapting to hidden DOM rather than visible behavior.
  Mitigation: require open-state/visibility assertions for desktop overlay content and keep mobile behavior tests behavior-first.
- Risk: browser validation is misreported as product failure when the actual blocker is missing Playwright binaries.
  Mitigation: treat browser installation as an explicit validation precondition and report it separately.

## Rollback Guidance
- If a repair reintroduces clutter on desktop, revert only the action-row/overlay presentation change and keep warning-rail and mobile fixes isolated.
- If test updates start compensating for broken behavior, revert the test-only changes and re-fix the state transition in `ViewerShell` instead.
