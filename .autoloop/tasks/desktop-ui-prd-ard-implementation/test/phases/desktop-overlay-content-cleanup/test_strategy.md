# Test Strategy

- Task ID: desktop-ui-prd-ard-implementation
- Pair: test
- Phase ID: desktop-overlay-content-cleanup
- Phase Directory Key: desktop-overlay-content-cleanup
- Phase Title: Move secondary desktop clutter into Open Viewer
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Compact desktop header: `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - Verifies the persistent desktop header keeps `SkyLens`, settings access, and the fixed quick-action row only
  - Verifies advanced desktop diagnostics like `Visible markers` and `Privacy reassurance` are absent before `Open Viewer` is opened
- Open Viewer reachability: `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - Verifies `Viewer snapshot`, `Visible markers`, `Camera`, and `Privacy reassurance` remain reachable after opening the desktop viewer panel
- Moved scope controls: `SkyLensServerless/tests/unit/viewer-shell.test.ts`
  - Verifies desktop scope quick controls are hidden in the persistent header and become reachable inside `Open Viewer` when scope mode is enabled

## Preserved invariants checked
- Desktop quick-action order remains `Open Viewer`, `Align`, `Enable AR`, `Scope`
- Desktop scope toggle state stays synchronized with mobile scope state and settings-sheet callbacks
- Permission-recovery routing for desktop `Enable AR` remains intact

## Edge cases / failure paths
- Scope-unavailable states still render the fixed desktop `Scope` quick action as disabled while keeping moved desktop scope controls absent
- Demo-mode desktop header stays compact before `Open Viewer` is expanded

## Reliability / stabilization
- Coverage stays in the existing deterministic jsdom `viewer-shell` unit slice
- Assertions use stable `data-testid` hooks and text checks instead of layout snapshots
- Existing canvas `getContext()` warnings are tolerated because assertions do not depend on canvas drawing output

## Known gaps
- This phase does not add visual regression or browser-layout tests; desktop header compactness is validated via semantic/unit assertions only
