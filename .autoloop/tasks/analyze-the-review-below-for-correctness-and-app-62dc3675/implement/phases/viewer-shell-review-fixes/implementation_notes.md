# Implementation Notes

- Task ID: analyze-the-review-below-for-correctness-and-app-62dc3675
- Pair: implement
- Phase ID: viewer-shell-review-fixes
- Phase Directory Key: viewer-shell-review-fixes
- Phase Title: Apply the applicable viewer-shell review fixes
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `tests/unit/viewer-shell.test.ts`

## Symbols touched
- `ViewerShell`
- `handleRetryMotionPermission`

## Checklist mapping
- Remove redundant inner mobile overlay `sm:hidden`: done in `viewer-shell.tsx`
- Sync motion retry state to `/view` via `router.replace(buildViewerHref(...))`: done in `handleRetryMotionPermission`
- Extend focused viewer-shell unit coverage for retry route sync: done in `viewer-shell.test.ts`

## Assumptions
- Motion retry remains a live-viewer-only route-state sync and should not alter demo-mode routing behavior.

## Preserved invariants
- The outer mobile overlay wrapper remains the sole `sm:hidden` breakpoint gate.
- Viewer route schema and query parameter names remain unchanged.
- Motion retry still uses existing orientation permission copy for denied/unavailable outcomes.

## Intended behavior changes
- Successful or failed live motion retries now update both local viewer state and the `/view` query string so `orientation` stays synchronized.
- The inner expanded mobile overlay wrapper no longer duplicates the parent `sm:hidden` responsive class.

## Known non-changes
- No changes to demo-mode routing, `ViewerRouteState`, or broader permission coordinator flow.
- No layout refactor beyond the redundant responsive class removal.

## Expected side effects
- Browser history behavior stays replace-based; retry does not add a new history entry.

## Validation performed
- Attempted `npm test -- viewer-shell`, but the workspace has no local `vitest` binary at `node_modules/.bin/vitest`, so the focused suite could not run here.

## Deduplication / centralization
- Reused the existing `buildViewerHref` route builder rather than adding a retry-specific routing helper.
