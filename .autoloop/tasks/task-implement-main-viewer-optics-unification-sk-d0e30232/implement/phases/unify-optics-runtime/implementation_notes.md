# Implementation Notes

- Task ID: task-implement-main-viewer-optics-unification-sk-d0e30232
- Pair: implement
- Phase ID: unify-optics-runtime
- Phase Directory Key: unify-optics-runtime
- Phase Title: Unify Active Optics Runtime
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/lib/astronomy/stars.ts`
- `SkyLensServerless/lib/projection/camera.ts`
- `SkyLensServerless/tests/unit/scope-optics.test.ts`
- `SkyLensServerless/tests/unit/projection-camera.test.ts`
- `SkyLensServerless/tests/unit/celestial-layer.test.ts`
- `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/e2e/demo.spec.ts`

## Symbols touched
- `ViewerShell`
- `buildSceneSnapshot`
- `normalizeVisibleStars`
- `pickCenterLockedCandidate`
- `MAIN_VIEW_OPTICS_RANGES`
- `getDefaultMainViewOptics`
- `normalizeMainViewOptics`
- `magnificationToMainViewVerticalFovDeg`
- `computeScopeLimitingMagnitude`
- `computeScopeRenderProfile`

## Checklist mapping
- Milestone 1: added runtime-only main-view optics defaults/state and shared main/scope optics helpers.
- Milestone 2: rewired active optics selection, deep-star request context, center-lock ranking, and quick-control callback routing in `viewer-shell`.
- Milestone 3: updated unit/integration/e2e coverage for main defaults, non-persistence, FOV-only magnification, aperture-driven emergence, and deterministic center-lock.

## Assumptions
- Main-view optics use the existing wide-view aperture baseline (`120mm`) with a runtime magnification default of `1.0x`.
- Scope transparency remains a persisted presentation control; it no longer affects limiting magnitude or emergence behavior.

## Preserved invariants
- Scope overlay toggle and lens diameter/transparency stay persisted and independent from main-view optics state.
- HYG remains the only deep-star dataset.
- Existing scope catalog/tile request invalidation trackers stay in place; request inputs changed, not the lifecycle contract.

## Intended behavior changes
- Main view now owns non-persisted aperture/magnification state, shows optics sliders by default, and uses magnification only for projection/FOV.
- Deep-star emergence is aperture-driven in both main and scope modes; threshold stars fade in via the emergence band instead of a hard limiting-magnitude cut.
- Center-lock now compares visible candidates by angular distance, then brightness, then stable id ordering.

## Known non-changes
- Scope overlay presentation remains optional and visually unchanged.
- Persisted storage schema stays scope-mode-only for optics values; no storage key rotation was introduced.

## Expected side effects
- On-object labels in scope mode now follow the active scope candidate set instead of preserving the wide-view winner highlight.
- Viewer FOV readouts now show decimal precision because the active optics FOV can be non-integer.

## Validation performed
- `npx vitest run tests/unit/scope-optics.test.ts tests/unit/projection-camera.test.ts tests/unit/viewer-settings.test.tsx tests/unit/celestial-layer.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Passed: 7 files, 184 tests.
- `npx vitest run tests/unit/scope-optics.test.ts tests/unit/projection-camera.test.ts tests/unit/viewer-settings.test.tsx tests/unit/celestial-layer.test.ts tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/settings-sheet.test.tsx`
  - Passed: 8 files, 192 tests.
- `npx playwright test tests/e2e/demo.spec.ts`
  - Blocked by missing system library `libatk-1.0.so.0`; Chromium headless shell exits before app assertions run, including after `npx playwright install chromium`.

## Attempt 3 note
- This turn validated the existing optics-unification implementation already present in the workspace; no additional product-code edits were required after the targeted unit suite passed.

## Deduplication / centralization
- Main and scope optics now share the same limiting-magnitude, render-profile, request-band, and center-lock helper paths.
- Main-view deep stars and scope-mode deep stars share one projection/filtering pipeline with mode-specific viewport/FOV inputs.
