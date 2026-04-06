# Implementation Notes

- Task ID: skylensserverless-scope-optics
- Pair: implement
- Phase ID: scope-optics-foundation
- Phase Directory Key: scope-optics-foundation
- Phase Title: Settings and Optics Foundation
- Scope: phase-local producer artifact

## Files changed

- `lib/viewer/settings.ts`
- `lib/viewer/scope-optics.ts`
- `lib/astronomy/stars.ts`
- `components/viewer/viewer-shell.tsx`
- `tests/unit/scope-optics.test.ts`
- `tests/unit/stars-scope-pipeline.test.ts`
- `tests/unit/celestial-layer.test.ts`
- `tests/unit/viewer-settings.test.tsx`

## Symbols touched

- `ViewerSettings`
- `ScopeOpticsSettings`
- `DEFAULT_SCOPE_OPTICS_SETTINGS`
- `normalizeScopeOpticsSettings`
- `computeLimitingMagnitude`
- `isStarVisibleWithScopeOptics`
- `computeStarPhotometry`
- `normalizeVisibleStars`
- `buildSceneSnapshot`

## Checklist mapping

- Plan Milestone 1 / settings schema extension: completed in `lib/viewer/settings.ts`
- Plan Milestone 1 / pure optics helpers: completed in `lib/viewer/scope-optics.ts`
- Plan Milestone 1 / star pipeline integration after existing gates: completed in `lib/astronomy/stars.ts`
- Plan Validation / optics + compatibility coverage: completed in the four touched unit test files
- Plan Milestone 2 / viewer controls and rendering UI: intentionally deferred to a later phase

## Assumptions

- This phase owns persistence, formulas, and star-pipeline wiring only; quick-controls/settings-surface relocation remains out of phase.
- Existing callers outside `ViewerShell` should continue to behave as pre-scope defaults unless they opt into the new inputs.

## Preserved invariants

- Storage key remains `skylens.viewer-settings.v1`
- Legacy payloads without scope fields still load safely
- Existing enabled-layer, likely-visible/daylight, and horizon gates still run before scope optics
- Non-star visibility logic remains unchanged
- Constellation construction still uses the already-filtered `visibleStars`

## Intended behavior changes

- Viewer settings now persist `scopeModeEnabled` and normalized `scopeOptics`
- Stars can receive `metadata.scopeRender` when scope mode is enabled
- Scope mode can further filter stars by limiting magnitude after existing gates

## Known non-changes

- No Bortle / sky-quality modeling
- No changes to aircraft, satellites, planets, or constellation gating semantics
- No quick-controls/settings-sheet control placement work in this phase
- No changes inside `SkyLensServerless/`

## Expected side effects

- Old persisted settings normalize onto the new scope defaults on first read/write
- Current bundled bright-star fixture scenes usually show unchanged star counts even with scope mode on because the catalog is shallow; the mocked pipeline test covers the actual filter branch

## Validation performed

- `npm ci`
- `npm test -- tests/unit/scope-optics.test.ts tests/unit/stars-scope-pipeline.test.ts tests/unit/celestial-layer.test.ts tests/unit/viewer-settings.test.tsx`
- `npx tsc --noEmit --pretty false 2>&1 | rg "lib/astronomy/stars.ts|tests/unit/scope-optics.test.ts|tests/unit/stars-scope-pipeline.test.ts|tests/unit/celestial-layer.test.ts|tests/unit/viewer-settings.test.tsx"`
- Full-repo `npx tsc --noEmit` still reports pre-existing unrelated type issues outside this phase slice

## Deduplication / centralization decisions

- Centralized all locked limiting-magnitude and photometric math in `lib/viewer/scope-optics.ts`
- Reused settings normalization for scope optics so clamps and defaults stay defined in one place
