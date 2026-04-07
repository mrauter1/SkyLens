# Implementation Notes

- Task ID: desktop-ui-prd-ard-implementation
- Pair: implement
- Phase ID: desktop-overlay-content-cleanup
- Phase Directory Key: desktop-overlay-content-cleanup
- Phase Title: Move secondary desktop clutter into Open Viewer
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `.autoloop/tasks/desktop-ui-prd-ard-implementation/decisions.txt`
- `.autoloop/tasks/desktop-ui-prd-ard-implementation/implement/phases/desktop-overlay-content-cleanup/implementation_notes.md`

## Symbols touched
- `ViewerShell`
- desktop `desktop-active-object-summary` render path
- desktop `desktop-next-action` render path
- desktop `desktop-scope-quick-controls` render path
- desktop scope-related `QuickRangeSlider` instances

## Checklist mapping
- Phase 2: reduced the persistent desktop header to a compact summary plus settings and the four quick actions
- Phase 2: moved desktop scope quick sliders out of the persistent header and into the desktop `Open Viewer` panel
- Phase 2 test coverage: updated desktop viewer-shell assertions so header-only chrome stays compact while `Open Viewer` still exposes the moved diagnostics and scope controls

## Assumptions
- Equivalent diagnostic/detail content already present inside the desktop `Open Viewer` surface is sufficient to preserve reachability when the redundant header body/rows are removed

## Preserved invariants
- Desktop quick-action order remains `Open Viewer`, `Align`, `Enable AR`, `Scope`
- Scope enable/disable state and viewer settings persistence are unchanged
- Mobile overlay and settings-sheet behavior are unchanged

## Intended behavior changes
- Desktop header no longer renders the verbose status body/rows or long next-action body beside the quick row
- Desktop scope aperture and magnification controls no longer persist beside the desktop quick-action row
- The desktop `Open Viewer` surface remains the place for fuller viewer diagnostics/details, including scope quick controls when enabled

## Known non-changes
- Viewer snapshot, crosshair object, selected object, manual observer, diagnostics, and privacy sections stay in the desktop `Open Viewer` panel
- Warning rail and settings presentation are untouched in this phase

## Expected side effects
- Desktop header is more compact and action-focused because it no longer duplicates diagnostic/status detail already available in `Open Viewer`
- Desktop hover/current-focus summary still updates in the header, but the richer supporting detail lives behind `Open Viewer`
- Scope-unavailable live states still show a disabled desktop `Scope` quick action, consistent with the fixed four-action desktop row

## Validation performed
- `pnpm --dir /workspace/SkyLens/SkyLensServerless exec vitest run tests/unit/viewer-shell.test.ts`

## Deduplication / centralization decisions
- Reused the existing desktop `QuickRangeSlider` controls and state wiring; only their render location changed to avoid introducing a new control path
