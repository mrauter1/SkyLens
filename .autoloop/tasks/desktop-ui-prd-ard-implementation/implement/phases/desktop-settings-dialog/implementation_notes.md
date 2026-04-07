# Implementation Notes

- Task ID: desktop-ui-prd-ard-implementation
- Pair: implement
- Phase ID: desktop-settings-dialog
- Phase Directory Key: desktop-settings-dialog
- Phase Title: Fix desktop settings clipping with a desktop dialog variant
- Scope: phase-local producer artifact

## Files Changed
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/settings-sheet.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `.autoloop/tasks/desktop-ui-prd-ard-implementation/decisions.txt`

## Symbols Touched
- `SettingsSheet`
- `ViewerShell` settings-sheet prop wiring

## Checklist Mapping
- Phase 5 desktop shell update: completed via `SettingsSheet` `presentation` branch.
- Phase 5 desktop dismiss/focus contract adoption: completed by reusing existing dismiss helpers and key handling.
- Phase 5 desktop reachability tests: completed in `settings-sheet.test.tsx`.

## Assumptions
- Desktop and mobile `SettingsSheet` instances remain separately rendered by `ViewerShell`, so explicit presentation selection is safer than viewport inference inside `SettingsSheet`.

## Preserved Invariants
- Settings content tree and callback contract remain shared between mobile and desktop.
- Focus restore suppression for the Alignment handoff path remains unchanged.
- Mobile settings keep the existing compact mobile panel shell.

## Intended Behavior Changes
- Desktop settings now render in a centered dialog with a dedicated internal scroll region and desktop-sized max width/height.

## Known Non-Changes
- No settings persistence, option semantics, or viewer permission flows were changed.
- No root-app mirror files outside `SkyLensServerless/` were touched.

## Expected Side Effects
- `ViewerShell` now passes an explicit settings presentation prop, allowing tests to pin desktop-vs-mobile shell selection.

## Validation Performed
- `pnpm --dir SkyLensServerless exec vitest run tests/unit/settings-sheet.test.tsx tests/unit/viewer-shell.test.ts`
- Result: passed (`2` files, `91` tests). Jsdom canvas `getContext()` warnings remain expected existing noise.

## Deduplication / Centralization
- Extracted shared settings header/content within `SettingsSheet` so only the shell differs between desktop and mobile presentations.
