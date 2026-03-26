# Mobile Overlay Plan

## Scope
- Implement the confirmed mobile iOS behavior by collapsing all non-stage viewer chrome behind a small bottom button that expands on tap.
- The confirmed `ALL COLLAPSE` clarification includes the current top mobile header/alignment badge area and the mobile `Settings` entry point, not only the lower details stack.
- Preserve desktop viewer layout and behavior at `sm` and above.
- Keep the change local to [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) and targeted viewer tests, touching [`components/settings/settings-sheet.tsx`](/workspace/SkyLens/components/settings/settings-sheet.tsx) only if a minimal accessibility hook is required for safe assertions.

## Current Baseline
- [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) already splits desktop and mobile presentation with `sm:flex` and `sm:hidden`.
- [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) already owns the mobile bottom-trigger state via `isMobileOverlayOpen` and the fixed bottom mobile container; implementation should reshape this existing branch rather than introduce a second overlay system.
- [`components/settings/settings-sheet.tsx`](/workspace/SkyLens/components/settings/settings-sheet.tsx) already owns settings interactions and should remain the single settings UI rather than being duplicated for mobile.
- [`tests/unit/viewer-shell.test.ts`](/workspace/SkyLens/tests/unit/viewer-shell.test.ts) already contains mobile overlay and desktop preservation assertions using `mobile-viewer-overlay*` and desktop test ids, so implementation should extend that suite instead of scattering duplicate coverage.
- Unit tests run in jsdom, so both responsive branches remain mounted in the DOM even when Tailwind would hide one visually. Validation must use control-level assertions rather than breakpoint-dependent text presence.

## Milestone
### Ship one focused mobile overlay slice
- Recompose the mobile viewer shell so the collapsed state leaves only the stage and a compact bottom trigger visible.
- Move the current mobile top header/alignment badge chrome, status/details content, blocked-state actions, and mobile access to `SettingsSheet` into the expanded bottom-sheet flow.
- Preserve the current desktop header, settings placement, status cards, detail cards, and privacy stack without behavioral changes.
- Reuse the existing mobile open/close state if possible, and keep mobile-only behavior localized to the existing responsive boundary instead of adding a JS viewport service.
- Keep the collapsed trigger and expanded sheet safe-area aware for iOS bottom insets, maintain 44px-class touch targets, and avoid obstructing stage interactions when collapsed.
- Prefer adding to the existing mobile overlay selectors/test ids before inventing new test-only hooks.

## Interfaces And Boundaries
- No public interface changes:
  - no route or query changes
  - no persisted viewer-settings changes
  - no API, config, or data-contract changes
- Internal UI boundary:
  - `ViewerShell` continues to own mobile overlay visibility and responsive composition
  - `SettingsSheet` remains the single settings control surface; only the mobile access point moves into the expanded overlay
- Primary edit surface:
  - mobile fixed-bottom overlay composition in [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx)
  - targeted mobile/desktop regression assertions in [`tests/unit/viewer-shell.test.ts`](/workspace/SkyLens/tests/unit/viewer-shell.test.ts)
- Testing interface:
  - if current accessible names are not specific enough to prove collapsed versus expanded mobile behavior, add minimal stable accessible labels or test ids rather than relying on hidden text

## Compatibility Notes
- Desktop behavior is an explicit compatibility requirement and must remain unchanged.
- Mobile behavior intentionally changes per the confirmed clarification: top mobile chrome is no longer always visible and becomes available through the expanded bottom overlay.
- Settings, retry permissions, demo-mode entry, selected-object details, and center-object summary must remain reachable on mobile after expansion.

## Validation
- Add or update focused viewer tests for:
  - mobile starts with only the compact bottom trigger exposed
  - opening the trigger reveals the mobile sheet and the previously top-visible mobile header/settings content
  - closing the sheet returns mobile to the collapsed state
  - blocked-state mobile flow still exposes retry/demo actions after expansion
  - desktop retains the current header/settings/detail composition
- Reuse the existing mobile overlay test ids in [`tests/unit/viewer-shell.test.ts`](/workspace/SkyLens/tests/unit/viewer-shell.test.ts) where possible; only touch settings-sheet tests if the settings integration contract actually changes.
- Run the relevant viewer-focused unit tests first, then run `npm run test` before closing the slice.

## Regression Prevention
- Preserve these invariants:
  - desktop informational chrome remains rendered and behaves the same at `sm` and above
  - on mobile, all non-stage viewer chrome is collapsed behind the bottom trigger by default
  - the compact trigger does not intercept label taps, drag/manual-pan gestures, or reticle interactions outside its own hit area
  - mobile expanded content is sourced from the same viewer-derived state as desktop, without creating a second data path
  - mobile settings and blocked-state actions remain accessible after expansion
- Prefer local composition changes in [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) over new shared abstractions unless duplication becomes the direct source of risk.

## Risk Register
- R1: Responsive edits could leak the mobile collapse behavior into desktop or vice versa.
  - Control: keep the split anchored to the existing `sm:flex` and `sm:hidden` layout boundary and add explicit desktop assertions.
- R2: Moving the mobile `Settings` entry point into the expanded overlay could make settings harder to reach or break focus/interaction flow.
  - Control: reuse `SettingsSheet`, keep a clear mobile entry point inside the expanded sheet, and validate access in tests.
- R3: The compact bottom trigger or expanded sheet could block stage interactions or sit incorrectly over the iOS safe area.
  - Control: preserve pointer-event boundaries, bottom safe-area padding, and minimum touch-target sizing.
- R4: Tests could pass falsely because hidden responsive branches remain mounted in jsdom.
  - Control: assert on specific controls and open/close behavior, and add stable selectors only where existing semantics are insufficient.

## Rollback
- Revert only the mobile composition changes in [`components/viewer/viewer-shell.tsx`](/workspace/SkyLens/components/viewer/viewer-shell.tsx) if the new collapsed-all-mobile behavior regresses interaction or access.
- Restore the current mobile top-chrome placement while leaving desktop rendering, settings logic, and viewer data flow untouched.
