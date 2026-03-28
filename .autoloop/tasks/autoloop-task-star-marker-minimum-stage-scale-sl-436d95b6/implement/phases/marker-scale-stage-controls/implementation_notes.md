# Implementation Notes

- Task ID: autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6
- Pair: implement
- Phase ID: marker-scale-stage-controls
- Phase Directory Key: marker-scale-stage-controls
- Phase Title: Implement marker scale setting and star minimum sizing
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `tests/unit/viewer-shell-celestial.test.ts`

## Symbols touched
- `getMarkerSizePx`

## Checklist mapping
- Plan item 1: reused existing `ViewerSettings.markerScale` state and persistence without schema/storage changes; confirmed current checkout already satisfied this.
- Plan item 2: corrected star marker scale-1 math so stars that were already larger than `6px` keep their old size at scale `1`, while stars that previously collapsed to the old floor can now resolve to `1px` before `markerScale` multiplication; non-star minimum logic remains `6px`.
- Plan item 3: confirmed the mobile quick-actions slider already lives above the stage action buttons and updates `viewerSettings.markerScale` live.
- Plan item 4: validated celestial marker sizing, quick-actions slider behavior, preserved mid-bright star sizing, and persisted viewer settings with targeted Vitest suites.

## Assumptions
- The existing quick-actions slider markup and `viewerSettings.markerScale` persistence in `ViewerShell` / `lib/viewer/settings.ts` were intentional in the current checkout and should be preserved.

## Preserved invariants
- `ViewerSettings.markerScale` remains the single persisted source of truth and still clamps to `1..4`.
- Non-star marker minimum behavior at scale `1` remains unchanged.
- Marker scale is still applied after the scale-1 size is computed.
- Stars that already rendered above `6px` at scale `1` keep their prior size curve.

## Intended behavior changes
- Stars that previously hit the old `6px` floor can now resolve below that floor down to `1px`, allowing dim stars to render at `1px` and at `4px` when `markerScale=4`.

## Known non-changes
- No viewer-settings schema/storage-key changes.
- No desktop dock or settings-sheet layout changes.
- No changes to non-star marker formulas beyond existing shared multiplier/minimum behavior.

## Expected side effects
- Only stars that previously collapsed to the old `6px` floor become visibly smaller at scale `1`; brighter stars keep their prior size and still scale proportionally with the stage slider.

## Validation performed
- `npm exec vitest run tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-settings.test.tsx`
- `npm exec eslint components/viewer/viewer-shell.tsx tests/unit/viewer-shell-celestial.test.ts lib/viewer/settings.ts tests/unit/viewer-settings.test.tsx`
- ESLint completed with the same pre-existing warnings in `components/viewer/viewer-shell.tsx` for `react-hooks/exhaustive-deps` and the unused `_cameraStatus` parameter; no new lint errors were introduced.

## Deduplication / centralization decisions
- Kept the sizing fix local to `getMarkerSizePx` in `ViewerShell`; a star-specific inline branch was sufficient without introducing a new shared helper.
