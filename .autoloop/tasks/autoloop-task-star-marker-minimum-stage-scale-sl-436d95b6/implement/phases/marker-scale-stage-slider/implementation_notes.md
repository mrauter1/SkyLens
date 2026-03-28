# Implementation Notes

- Task ID: autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6
- Pair: implement
- Phase ID: marker-scale-stage-slider
- Phase Directory Key: marker-scale-stage-slider
- Phase Title: Add persisted marker scale and star minimum sizing
- Scope: phase-local producer artifact
- Files changed: `lib/viewer/settings.ts`; `components/viewer/viewer-shell.tsx`; `tests/unit/viewer-settings.test.tsx`; `tests/unit/viewer-shell.test.ts`; `tests/unit/viewer-shell-celestial.test.ts`
- Symbols touched: `ViewerSettings.markerScale`; `SettingsSchema`; `getDefaultViewerSettings`; `normalizeViewerSettings`; `getMarkerSizePx`; `getScaleOneMarkerSizePx`; `getScaleOneStarMarkerSizePx`; `getMarkerBaseSizePx`; `getLegacyStarBaseSizePx`; `getStarFloorOnlyBoostLimit`; `getMarkerMinimumSizePx`; `formatMarkerScaleValue`
- Checklist mapping: plan item 1 complete via persisted `markerScale` schema/default/clamp; plan item 2 complete via star-specific base/min sizing and multiplier application; plan item 3 complete via mobile quick-action slider and live label; plan item 4 complete via focused unit coverage
- Assumptions: the requested bottom stage controls area maps to the existing mobile quick-action dock; keeping the settings sheet unchanged remains acceptable unless parity is explicitly requested later
- Preserved invariants: existing viewer settings storage key/path unchanged; non-star minimum floor remains `6px` at scale `1`; non-star base formulas unchanged aside from post-floor multiplier
- Intended behavior changes: dim stars can now render at `1px` while stars that were already above the old `6px` floor keep their previous scale-1 rendered size; marker sizes scale live from `1.0` to `4.0`; `markerScale` persists and legacy saved settings default to `1`
- Known non-changes: no desktop-only slider; no settings-sheet slider; no changes to label layout, center-lock selection, or alignment flows
- Expected side effects: larger scale values intentionally increase marker/icon footprint and may increase visual overlap on crowded stages
- Validation performed: `pnpm install --frozen-lockfile`; `pnpm exec vitest run tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`; `pnpm exec prettier --check components/viewer/viewer-shell.tsx lib/viewer/settings.ts tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts`
- Deduplication / centralization: split marker sizing into shared scale-1/base/min helpers so star floor remapping and scale multiplication stay in one rendering path

## Run `run-20260328T042344Z-f92e342e`

- Files changed this turn: `.autoloop/tasks/autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6/decisions.txt`; `.autoloop/tasks/autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6/implement/phases/marker-scale-stage-slider/implementation_notes.md`
- Source files verified in scope: `lib/viewer/settings.ts`; `components/viewer/viewer-shell.tsx`; `tests/unit/viewer-settings.test.tsx`; `tests/unit/viewer-shell.test.ts`; `tests/unit/viewer-shell-celestial.test.ts`
- Checklist mapping: plan items 1 through 4 already satisfied by the existing workspace state; no additional source patching was required in this run
- Preserved invariants: no extra UI surfaces added beyond the mobile quick-action dock; existing viewer-settings storage path unchanged; non-star scale-1 floor remains `6px`
- Intended behavior changes confirmed in source: `markerScale` defaults to `1` and clamps to `1..4`; dim stars can render at `1px`; rendered marker sizes scale live from the scale-1 result
- Known non-changes: no settings-sheet slider; no desktop-only slider; no adjustments to label placement, center-lock, or selection logic
- Validation performed this turn: `pnpm exec vitest run tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts` -> `3 passed`, `87 passed`

## Run `run-20260328T042815Z-review-fix`

- Files changed this turn: `components/viewer/viewer-shell.tsx`; `tests/unit/viewer-shell-celestial.test.ts`; `.autoloop/tasks/autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6/decisions.txt`; `.autoloop/tasks/autoloop-task-star-marker-minimum-stage-scale-sl-436d95b6/implement/phases/marker-scale-stage-slider/implementation_notes.md`
- Checklist mapping: plan item 2 refined to preserve prior scale-1 star sizes above the old floor while still allowing dim stars to reach `1px`; plan item 4 updated with a regression test for representative non-dim stars
- Preserved invariants: stars that previously rendered above the old `6px` floor keep their prior scale-1 rendered size; non-star scale-1 floors remain `6px`; mobile quick-action slider wiring and persistence path unchanged
- Intended behavior changes confirmed this turn: only stars that previously floor-clamped are remapped below `6px`; normal stars retain their old scale-1 rendered size while still honoring the new scale multiplier
- Validation performed this turn: `pnpm exec vitest run tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts` -> `3 passed`, `88 passed`; `pnpm exec prettier --check components/viewer/viewer-shell.tsx tests/unit/viewer-shell-celestial.test.ts` -> pass
