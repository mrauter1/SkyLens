# Implementation Notes

- Task ID: task-desktop-declutter-mobile-safe-navigation-an-94bfedd9
- Pair: implement
- Phase ID: simplify-viewer-shell
- Phase Directory Key: simplify-viewer-shell
- Phase Title: Simplify shared viewer chrome
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `tests/unit/viewer-shell.test.ts`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/e2e/demo.spec.ts`
- `tests/e2e/landing.spec.ts`
- `tests/e2e/permissions.spec.ts`
- `.autoloop/tasks/task-desktop-declutter-mobile-safe-navigation-an-94bfedd9/decisions.txt`

## Symbols touched
- `ViewerShell`
- `openAlignmentExperience`
- `startAlignmentFocus`
- local desktop action / warning rail / shared overlay render helpers inside `viewer-shell.tsx`

## Checklist mapping
- Milestone 1: replaced the old desktop persistent shell with a fixed desktop action row plus shared overlay content.
- Milestone 3: moved warning presentation into a compact top rail and kept recovery actions reachable.
- Phase AC-1: preserved object detail, selected-object detail, manual observer, and privacy content inside the shared overlay.
- Phase AC-2: motion and related warnings now render in the compact top rail.
- Phase AC-3: desktop primary row now exposes `Open Viewer`, `Enable Camera`, `Motion`, and `Align`.
- Deferred: desktop pointer-reticle hover semantics and broader mobile navigation fixes remain for later phases.

## Assumptions
- Phase scope is limited to shared shell simplification, warning compaction, and desktop primary controls; hover/fine-pointer behavior is intentionally not implemented in this turn.
- Reusing the same overlay content structure across desktop and mobile is preferable to preserving the old compact/live-only content split.

## Preserved invariants
- Camera/motion recovery still routes through existing startup/retry handlers.
- Combined recovery preserves the existing motion -> camera -> location startup ordering.
- Mobile alignment focus, overlay backdrop behavior, and settings-sheet state ownership remain in `viewer-shell.tsx`.
- Route/query contracts and persisted viewer settings schema are unchanged.

## Intended behavior changes
- Desktop default chrome is now a minimal bottom action row rather than always-open stacked panels.
- Warning messages now appear in a top rail instead of inside large desktop/mobile overlay cards.
- Mobile and desktop viewer overlays now use the same core detail/privacy/recovery content blocks.

## Known non-changes
- No route or storage schema changes.
- No changes to the underlying permission coordinator or sensor subscription flow.
- No new global layout abstraction outside `viewer-shell.tsx`.

## Expected side effects
- Demo, camera, motion, and alignment guidance messaging now appears in the top rail instead of only inside overlays.
- Compact live mobile overlays now include the shared privacy/detail content, increasing scrollable content length.

## Validation performed
- `pnpm test tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts` could not run because local `node_modules` / `vitest` are missing in this workspace.
- `pnpm lint ...` could not run because local `eslint-config-next` and other dev dependencies are missing in this workspace.
- `tsc -p tsconfig.json --noEmit --pretty false` confirmed the workspace is missing installed dependencies and types; it did not provide repo-specific validation.
- `tsc components/viewer/viewer-shell.tsx --jsx react-jsx --noEmit --noResolve ...` reached import/type-resolution failures only and did not surface local syntax errors in the touched file.

## Deduplication / centralization
- Consolidated repeated desktop/mobile overlay panels into local shared render helpers inside `viewer-shell.tsx`.
- Centralized compact warning display into a single top-rail data model instead of duplicating banner stacks per branch.
