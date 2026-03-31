# Implementation Notes

- Task ID: skylensserverless-ux-implementation
- Pair: implement
- Phase ID: overlay-foundation
- Phase Directory Key: overlay-foundation
- Phase Title: Overlay foundation and dismissal policy
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/settings-sheet.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/e2e/demo.spec.ts`
- `SkyLensServerless/tests/e2e/permissions.spec.ts`
- `.autoloop/tasks/skylensserverless-ux-implementation/decisions.txt`

## Symbols touched
- `SettingsSheet`
- `ViewerShell`
- `AlignmentInstructionsContent`
- local viewer focus/dismiss helpers: `openMobileViewerOverlay`, `closeMobileViewerOverlay`, `openAlignmentExperience`, `closeAlignmentExperience`, `handleMobileViewerOverlayKeyDown`, `handleMobileAlignmentOverlayKeyDown`

## Checklist mapping
- Milestone 1 / overlay foundation: completed for settings backdrop dismissal, shared mobile viewer sheet contract, guarded alignment dismissal exception, and viewer-owned opener/fallback focus restore.
- Milestone 3 / regression hardening: partial via touched unit/e2e coverage only; desktop hierarchy work intentionally deferred to later phase.

## Assumptions
- Mobile viewer quick actions remain the correct surviving reopen surface after mobile overlay/alignment dismissal.
- Desktop `SettingsSheet` stays mocked in `viewer-shell` unit coverage; settings behavior is covered directly in `settings-sheet.test.tsx`.

## Preserved invariants
- Existing mobile overlay/alignment selectors stay in place.
- Viewer scroll-lock gating still stays owned by `ViewerShell`.
- Alignment focus mode remains non-dismissible by backdrop because the sheet exists only for the instructions surface, not the guarded focus state.

## Intended behavior changes
- `SettingsSheet` now closes from backdrop click as well as Escape and restores focus to its trigger.
- Mobile viewer overlays always render through the shared `CompactMobilePanelShell` contract, including non-live states.
- Mobile alignment instructions now dismiss on backdrop click and Escape.
- Dismissible viewer-owned mobile overlays restore focus to their opener or a surviving fallback control.

## Known non-changes
- No route/storage contract changes.
- No new modal infrastructure.
- No desktop landing/banner hierarchy adjustments in this phase.
- `compact-mobile-panel-shell.tsx` did not need API changes for this phase; existing shell hooks were sufficient for convergence.

## Expected side effects
- Unit expectations for the previous bespoke fullscreen mobile overlay branch now point at the shared sheet structure.
- The reopened-alignment regression now re-queries the remounted mobile viewer trigger before reopening the overlay, matching the actual React lifecycle of that control.
- E2E coverage now includes settings-backdrop and alignment-backdrop dismissal scenarios, but browser execution depends on host Playwright/system libraries.

## Validation performed
- `npx vitest run tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts -t "closes on Escape and returns focus to the settings trigger|closes on backdrop click, ignores inner clicks, and restores focus to the trigger|closes the mobile viewer overlay on Escape and restores focus to the trigger|closes mobile overlay on backdrop click without closing from inner panel clicks|keeps Start alignment visible if the mobile viewer overlay is reopened while alignment is open|closes the alignment overlay on backdrop click and restores focus to mobile Align|falls back to the mobile Align action when alignment closes after its settings opener unmounts|prefers the visible mobile settings trigger when alignment closes over a reopened mobile viewer overlay" --reporter=verbose`
- `npx playwright test tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts`
  - blocked by missing system library `libatk-1.0.so.0` after installing Playwright Chromium; browser never launched.

## Deduplication / centralization
- Consolidated the non-live mobile viewer overlay onto the same `CompactMobilePanelShell` path already used for live camera states instead of maintaining a second fullscreen DOM branch.
