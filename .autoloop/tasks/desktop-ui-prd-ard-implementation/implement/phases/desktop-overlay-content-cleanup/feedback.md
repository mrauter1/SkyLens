# Implement ↔ Code Reviewer Feedback

- Task ID: desktop-ui-prd-ard-implementation
- Pair: implement
- Phase ID: desktop-overlay-content-cleanup
- Phase Directory Key: desktop-overlay-content-cleanup
- Phase Title: Move secondary desktop clutter into Open Viewer
- Scope: phase-local authoritative verifier artifact

- IMP-001 [blocking] `SkyLensServerless/components/viewer/viewer-shell.tsx` (`desktop-viewer-header`, `desktop-active-object-summary`, `desktop-next-action`): AC-1 is still unmet. The patch only moved the desktop scope sliders, but the desktop header still keeps large diagnostic/status content beside the quick actions, including the persistent active-object/status summary with alignment and camera rows and the bulky next-action card/body. The accepted phase contract calls for secondary desktop clutter to move behind `Open Viewer` so the desktop header becomes compact and action-focused. Minimal fix: relocate the non-essential diagnostic/status body and rows that remain adjacent to the quick row into the desktop `Open Viewer` surface, or reduce the header to the compact-summary-plus-actions shape defined in the accepted plan.
- IMP-002 [non-blocking] Re-review result for cycle 2: `IMP-001` is resolved. The desktop header now stays compact and action-focused, the moved diagnostics/advanced controls remain reachable through `Open Viewer`, and the updated `viewer-shell` coverage checks both the compact desktop header contract and overlay content availability.
