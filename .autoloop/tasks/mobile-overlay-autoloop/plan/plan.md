# Mobile Overlay Plan

## Scope
- Implement the mobile iOS viewer change by collapsing the informational overlay stack behind a small bottom button that expands on tap.
- Preserve the existing desktop viewer layout and behavior.
- Keep the change local to the viewer shell and its styling/tests unless a tiny shared extraction clearly reduces duplication.
- Source of truth: immutable request snapshot plus the current run log; there are no later clarifications.

## Current Baseline
- `components/viewer/viewer-shell.tsx` already separates desktop and mobile informational overlays with `sm:flex` and `sm:hidden`.
- Mobile already uses `isMobileOverlayOpen` to toggle a bottom sheet, but the implementation should be treated as the only mobile-specific surface to adjust for the requested iOS UI polish.
- Desktop informational cards currently include status badges, fallback banners, the celestial summary card, the bottom dock, the selected-object card, and privacy reassurance content.
- Existing viewer behavior that must remain intact: center-lock selection, selected-object details, retry/demo fallback actions, settings access, and the stage/reticle interaction model.

## Milestone
### Ship one focused mobile overlay slice
- Update the mobile-only viewer overlay presentation in `components/viewer/viewer-shell.tsx` so the informational cards are collapsed by default into a compact bottom trigger and expand into the existing mobile detail surface on tap.
- Preserve the desktop overlay stack exactly as a desktop-only layout; do not change desktop card order, copy, or interaction flow unless required to keep shared rendering correct.
- Keep the mobile trigger and expanded sheet safe-area aware for iOS bottom insets and maintain minimum touch-target sizing.
- Reuse the existing mobile overlay open/close state unless a rename improves clarity without widening scope.
- Audit the mobile expanded content so it still exposes the essential status/fallback information, the centered-object summary or empty-state hint, and blocked-state actions.
- Add or update focused unit coverage for the mobile collapsed/expanded behavior and for the unaffected desktop/bottom-dock semantics.

## Interfaces And Boundaries
- No public interface changes:
  - no route/query changes
  - no persisted settings changes
  - no API/config contract changes
- Internal state boundary:
  - mobile overlay visibility remains local viewer UI state inside `ViewerShell`
  - desktop responsive behavior continues to be controlled by existing responsive classes rather than a new JS viewport service
- Affected implementation files are expected to stay limited to:
  - `components/viewer/viewer-shell.tsx`
  - `app/globals.css` only if current utility classes cannot express the required compact iOS-safe trigger/sheet polish
  - targeted viewer unit tests

## Validation
- Run focused viewer unit tests covering the overlay shell and celestial bottom-dock behavior.
- Run the full `npm run test` suite before closing the slice.
- Add assertions for:
  - mobile detail UI starts collapsed behind a bottom trigger
  - tapping the trigger opens the mobile sheet
  - tapping close collapses it again
  - blocked-state mobile content still exposes retry/demo actions when expanded
  - center-locked and selected-object content remains unchanged in the existing desktop/bottom-dock flows

## Compatibility Notes
- Desktop behavior is a hard compatibility requirement for this task.
- The change must not alter current viewer state contracts, selected-object persistence rules, fallback routing, or settings behavior.
- Because the viewer is mobile-first and specifically called out for iOS, safe-area spacing and touch target size are compatibility constraints, not optional polish.

## Regression Prevention
- Keep the stage interaction surface unobstructed when the mobile sheet is collapsed so label taps, drag/manual-pan gestures, and reticle behavior are unaffected.
- Do not duplicate or fork the desktop informational rendering into a separate mobile-only logic path beyond the existing presentation boundary; shared content should still come from the same viewer-derived data.
- Preserve these invariants:
  - desktop informational stack remains available at `sm` and above
  - mobile informational UI is collapsed by default and expands only from the bottom trigger
  - blocked-state actions remain reachable on mobile
  - center-lock and selected-object cards still render from the current scene data without changing prioritization or copy

## Risk Register
- R1: Responsive edits could accidentally expose or hide the wrong overlay content across breakpoints.
  - Control: keep the desktop/mobile split anchored to the existing `sm:flex` and `sm:hidden` boundaries and cover both paths with unit assertions.
- R2: A compact bottom trigger could block stage interactions or safe-area spacing on iOS.
  - Control: preserve pointer-event boundaries, minimum hit area, and current bottom safe-area padding semantics.
- R3: Simplifying the mobile overlay could drop blocked-state or centered-object information.
  - Control: explicitly test blocked-state actions and center-object summary content in the expanded sheet.
- R4: Refactoring shared overlay markup could create subtle regressions in the desktop stack.
  - Control: prefer local presentation edits over structural abstraction unless duplication becomes the direct source of breakage.

## Rollback
- Revert only the mobile overlay presentation changes if iOS/mobile behavior regresses, while keeping the existing desktop stack and viewer data pipeline untouched.
- If a shared markup adjustment destabilizes desktop behavior, roll back to the current duplicated mobile content shape rather than introducing a larger abstraction during this slice.
