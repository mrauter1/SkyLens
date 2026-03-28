# Implementation Notes

- Task ID: skylens-task-alignment-settings-parity-with-open-e4c7e805
- Pair: implement
- Phase ID: mobile-overlay-parity
- Phase Directory Key: mobile-overlay-parity
- Phase Title: Unify compact mobile panel shell and align overlay behavior
- Scope: phase-local producer artifact

## Files changed
- `components/ui/compact-mobile-panel-shell.tsx`
- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/e2e/permissions.spec.ts`

## Symbols touched
- `CompactMobilePanelShell`
- `COMPACT_MOBILE_PANEL_MAX_HEIGHT`
- `ViewerShell`
- `AlignmentInstructionsPanel`
- `AlignmentInstructionsContent`
- `SettingsSheet`

## Checklist mapping
- Plan 1: added shared compact mobile shell/panel/scroll-region primitive and reused it for compact Open viewer + Settings; compact Align now consumes the same contract through a fixed overlay wrapper.
- Plan 2: moved compact Align out of `mobile-viewer-quick-actions` into `mobile-alignment-overlay-*` fixed overlay hooks above the stage controls while preserving explicit close/start-alignment behavior.
- Plan 3: updated unit and e2e coverage for overlay placement, shared max-height parity, internal scroll-region behavior, and reopened-viewer alignment flow.

## Assumptions
- Compact parity is scoped to the mobile live viewer path; desktop alignment content remains unchanged.
- Existing viewer behavior that allows reopening the compact Open viewer while alignment is already open is intentional and must be preserved.

## Preserved invariants
- Align remains explicitly opened/closed and did not gain backdrop-dismiss behavior.
- Start alignment still transitions into alignment focus and alignment focus still hides mobile overlay chrome.
- Settings dialog semantics, focus trap, and `onOpenChange` flow stay owned by `SettingsSheet`.

## Intended behavior changes
- Compact Align now renders in a fixed overlay sibling above the quick-action rail instead of inline inside `mobile-viewer-quick-actions`.
- Compact Open viewer, Settings, and Align now share the same compact max-height token and non-scrolling shell + internal scroll-region structure.

## Known non-changes
- Desktop viewer layout and desktop alignment panel structure were not refactored.
- Persisted viewer settings, routes, tutorial copy, and permission logic remain unchanged.

## Expected side effects
- Compact viewer/settings shells now share the same radius/spacing shell token from the shared primitive.
- Compact alignment overlay stays visible above the compact viewer sheet when the viewer sheet is reopened mid-alignment.

## Validation performed
- `npm test -- --run tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx`
- `npm run test:e2e -- tests/e2e/permissions.spec.ts --grep "compact alignment panel keeps lower controls reachable on a short viewport"`
- Environment setup needed for local verification: `npm install` and `npx playwright install --with-deps chromium`

## Deduplication / centralization
- Removed duplicated compact mobile shell/max-height markup from `ViewerShell` and `SettingsSheet` into `CompactMobilePanelShell`.
- Split alignment body markup into `AlignmentInstructionsContent` so the same content can render inside the shared compact shell without duplicating alignment controls or flow logic.
