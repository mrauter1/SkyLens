# Implementation Notes

- Task ID: task-fix-mobile-viewer-and-alignment-overlay-scr-370f5c32
- Pair: implement
- Phase ID: mobile-overlay-scroll-fix
- Phase Directory Key: mobile-overlay-scroll-fix
- Phase Title: Fix compact mobile overlay and alignment scrolling
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/e2e/demo.spec.ts`
- `tests/e2e/permissions.spec.ts`

## Symbols touched
- `ViewerShell`
- `AlignmentInstructionsPanel`
- `COMPACT_MOBILE_OVERLAY_MAX_HEIGHT`
- `COMPACT_ALIGNMENT_PANEL_MAX_HEIGHT`

## Checklist mapping
- Mobile overlay bounded internal scroll in compact live-camera mode: done in `ViewerShell` compact overlay branch.
- Compact alignment panel bounded internal scroll: done in `AlignmentInstructionsPanel` compact styling.
- Preserve overlay trigger/backdrop/test IDs and stage lock: preserved; selectors unchanged.
- Focused unit and e2e coverage: done in `tests/unit/viewer-shell.test.ts`, `tests/e2e/demo.spec.ts`, and `tests/e2e/permissions.spec.ts`.

## Assumptions
- Compact live-camera overflow should move into the overlay card/content rather than re-enabling document or stage scrolling.
- Compact alignment reachability can be guarded via the existing `alignment-instructions-panel` selector without adding a new test-only wrapper.

## Preserved invariants
- `shouldLockViewerScroll` remains the authority for document/body/stage overflow locking.
- `mobile-viewer-overlay-shell`, `mobile-viewer-overlay-scroll-region`, `mobile-viewer-overlay`, `mobile-viewer-overlay-backdrop`, `alignment-instructions-panel`, and `alignment-start-action` remain in use.
- Backdrop close and inner panel click isolation remain unchanged.

## Intended behavior changes
- Compact live-camera overlay now caps its height to the viewport-safe area and scrolls inside `mobile-viewer-overlay-compact-content`.
- Compact alignment instructions panel now caps its height and scrolls internally so lower actions remain reachable on short screens.

## Known non-changes
- Desktop viewer layout and desktop alignment panel layout were not changed.
- Permission-flow logic and route-state behavior were not changed.

## Expected side effects
- Existing demo/live mobile e2e interactions needed tighter click targeting because the modal/backdrop hit areas are now exercised more directly.

## Validation performed
- `npm ci`
- `npm run test -- tests/unit/viewer-shell.test.ts`
- `npx playwright install --with-deps chromium`
- `npm run test:e2e -- tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts`
- `npm run test`

## Deduplication / centralization
- Centralized the compact viewport height constraints as `COMPACT_MOBILE_OVERLAY_MAX_HEIGHT` and `COMPACT_ALIGNMENT_PANEL_MAX_HEIGHT` in `viewer-shell.tsx`.
