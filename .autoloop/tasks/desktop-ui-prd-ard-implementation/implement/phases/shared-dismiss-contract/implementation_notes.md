# Implementation Notes

- Task ID: desktop-ui-prd-ard-implementation
- Pair: implement
- Phase ID: shared-dismiss-contract
- Phase Directory Key: shared-dismiss-contract
- Phase Title: Standardize outside-click, Escape-close, and focus restore
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/ui/dismissable-layer.ts`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/settings-sheet.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `.autoloop/tasks/desktop-ui-prd-ard-implementation/decisions.txt`

## Symbols touched
- `focusAfterDismiss`
- `resolveFocusRestoreTarget`
- `trapFocusWithinPanel`
- `SettingsSheet`
- `ViewerShell`

## Checklist mapping
- Phase 4 / dismiss contract: centralized shared focus/dismiss helpers for the touched surfaces.
- Phase 4 / settings sheet: reused the shared helper path and added explicit inside-panel click containment.
- Phase 4 / tests: added regression assertions for backdrop focus restore and alignment Escape/inside-click behavior.

## Assumptions
- Current phase scope remains limited to the existing mobile viewer overlay, mobile alignment overlay, and current settings sheet presentation.

## Preserved invariants
- ViewerShell continues to own viewer-level open-state reporting and scroll lock.
- Existing permission recovery and viewer operation flows are unchanged.
- Focus restore for alignment still prefers the original opener when it remains visible and connected.

## Intended behavior changes
- Settings now uses the same focus-trap and post-dismiss restore logic as the mobile overlays.
- Clicking Alignment from settings closes the sheet without restoring focus to its trigger before the alignment surface takes over.

## Known non-changes
- No generic modal framework was introduced.
- Desktop settings dialog layout remains out of scope for this phase.
- Viewer stage interactions outside dismiss/focus handling were not changed.

## Expected side effects
- Shared dismiss behavior is easier to regression-test because focusability and restore rules are defined in one place.

## Validation performed
- `pnpm install --frozen-lockfile`
- `pnpm exec vitest run --root SkyLensServerless tests/unit/settings-sheet.test.tsx`
- `pnpm exec vitest run --root SkyLensServerless tests/unit/viewer-shell.test.ts`

## Deduplication / centralization
- Moved shared focusability, focus trap, and focus restore helpers out of `ViewerShell` into `components/ui/dismissable-layer.ts` and reused them from `SettingsSheet`.
