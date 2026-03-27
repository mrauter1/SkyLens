# Implementation Notes

- Task ID: implement-alignment-target-diagnosis-and-fix-pla-29e6230a
- Pair: implement
- Phase ID: align-target-default-and-override-fix
- Phase Directory Key: align-target-default-and-override-fix
- Phase Title: Fix alignment target selection defaults and override behavior
- Scope: phase-local producer artifact

## Files changed
- `components/viewer/viewer-shell.tsx`
- `components/settings/settings-sheet.tsx`
- `tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/settings-sheet.test.tsx`
- `tests/unit/viewer-settings.test.tsx`

## Symbols touched
- `ViewerShell`
- `manualAlignmentTargetPreference`
- `resolveCalibrationTarget`
- `resolveDefaultAlignmentTargetPreference`
- `resolveVisibleCalibrationTargetCandidates`
- `AlignmentTargetButton` in viewer shell
- `AlignmentTargetButton` in settings sheet

## Checklist mapping
- Always-selectable Sun/Moon controls: completed in both alignment button renderers and updated settings/viewer-settings tests.
- Visibility-aware default selection: completed in `ViewerShell` with shared visible-target extraction and heuristic coverage for sun-only, moon-only, both-visible, and neither-visible cases.
- Initial-render heuristic application: completed by deriving the effective preference synchronously in render until a manual override exists.
- Sticky manual override: completed with session-local override state and rerender/scene-change coverage in `viewer-shell-celestial`.
- Preserve fallback metadata and resolution order: preserved by reusing the existing calibration-target chain after the preferred-target lookup fails.

## Assumptions
- Equal Sun/Moon elevation should resolve to Sun for a deterministic tie without changing the requested fallback chain.

## Preserved invariants
- Calibration execution still falls back through visible Sun, Moon, planet, star, then north marker.
- `alignmentTargetAvailability` and fallback messaging remain informational and continue to reflect preferred-target availability.
- No persisted settings fields, routes, or public interfaces were added or changed.

## Intended behavior changes
- Sun and Moon alignment buttons remain clickable even when their availability flags are false.
- Default selected alignment target now follows visible-body likelihood until the user makes an explicit selection.
- After a manual Sun/Moon selection, subsequent rerenders and scene changes in the same mounted viewer session no longer overwrite that choice.

## Known non-changes
- Calibration fallback order and target descriptions remain unchanged.
- Alignment preference is still session-local and not persisted.

## Expected side effects
- Night scenes with neither body visible now default the selected preference to Moon while still calibrating against the existing fallback target when needed.

## Validation performed
- `npm ci`
- `npx vitest run tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell-celestial.test.ts`
- `npx vitest run tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx`
- `npm test`

## Deduplication / centralization
- Shared visible Sun/Moon/planet/star extraction feeds both default-target selection and calibration-target resolution inside `viewer-shell.tsx`, while the effective selected target is now derived synchronously from that heuristic unless the user has explicitly overridden it.
