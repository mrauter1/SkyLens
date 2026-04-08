# Implementation Notes

- Task ID: main-view-projection-performance-parity-rerun
- Pair: implement
- Phase ID: deep-star-governance-and-settings
- Phase Directory Key: deep-star-governance-and-settings
- Phase Title: Main-View Deep-Star Governance
- Scope: phase-local producer artifact

## Files Changed
- `SkyLensServerless/lib/viewer/settings.ts`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/lib/viewer/star-colors.ts`
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
- `SkyLensServerless/tests/unit/settings-sheet.test.tsx`
- `SkyLensServerless/tests/unit/scope-optics.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`

## Symbols Touched
- `ViewerSettings`
- `SettingsSheet`
- `resolveMainViewDeepStarGovernor`
- `getMainViewDeepStarBand`
- `MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS`
- `MAIN_VIEW_DEEP_STAR_STARTUP_VISIBLE_COUNT_BAND`
- `getStarColorFromBMinusV`
- `ViewerShell`
- `DevelopmentMainViewDeepStarDiagnostics`

## Checklist Mapping
- Milestone 2 / persisted main-view deep-star flag: completed in `settings.ts`
- Milestone 2 / settings-sheet control wiring: completed in `settings-sheet.tsx`
- Milestone 2 / deterministic governor tiers, hysteresis, precedence, startup baseline: completed in `scope-optics.ts` and `viewer-shell.tsx`
- Milestone 2 / main-view marker-label silence with focused exceptions: completed in `viewer-shell.tsx`
- Milestone 3 / shared B-V color semantics: completed in `star-colors.ts`, `scope-star-canvas.tsx`, and `viewer-shell.tsx`
- Milestone 3 / dev-only diagnostics: completed in `viewer-shell.tsx`
- Milestone 4 / disabled-mode, governor, diagnostics, and startup-band coverage: completed in the touched unit tests

## Assumptions
- Backward-compatible storage should default `mainViewDeepStarsEnabled` to `true` so older settings payloads preserve existing main-view behavior unless the user explicitly disables it.
- The conservative startup workload contract is satisfied by the default main-view optics plus the governor `baseline` tier targeting the `mag6p5` band.

## Preserved Invariants
- Scope-mode deep-star selection still uses the existing `selectScopeBand()` path and keeps scope behavior unchanged.
- Existing daylight suppression and stars-layer gates remain hard-off inputs before any governor tier selection.
- Main-view deep stars still participate in center-lock and selected-detail flows when not hard-disabled.

## Intended Behavior Changes
- Users can now disable main-view deep stars persistently from settings.
- Main-view deep-star tile/index loading is skipped entirely when a hard-off gate wins.
- Main-view deep-star markers and labels now stay silent unless the deep star is center-locked or selected.
- Development builds now expose main-view deep-star tier, precedence winner, transition reason, and the documented startup visible-count band.

## Known Non-Changes
- No scope-mode deep-star policy changes.
- No production-visible diagnostics or new telemetry/logging infrastructure.
- No changes to the previously completed shared non-scope projection context.

## Expected Side Effects
- Focused main-view deep-star markers now reuse the shared B-V color mapping while keeping an amber focus halo.
- Startup main-view deep-star depth stays conservative until magnification crosses explicit governor thresholds.

## Validation Performed
- `cd SkyLensServerless && pnpm exec vitest run tests/unit/scope-optics.test.ts tests/unit/settings-sheet.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-shell.test.ts`
- `cd SkyLensServerless && pnpm exec vitest run tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-celestial.test.ts tests/unit/celestial-layer.test.ts tests/unit/projection-camera.test.ts`

## Deduplication / Centralization
- Centralized main-view deep-star tiering and precedence in `resolveMainViewDeepStarGovernor()` instead of duplicating threshold logic in `viewer-shell.tsx`.
- Centralized star color mapping in `getStarColorFromBMinusV()` so scope canvas and focused main-view deep-star markers share one B-V palette source.
