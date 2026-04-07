# Main-Viewer Optics Unification Plan

## Scope
- Implement only `SkyLensServerless` optics, settings, viewer, and deep-star paths needed by `PRD_ARD_MAIN_VIEW_OPTICS_UNIFICATION.md`.
- Keep scope lens overlay optional presentation; do not remove or redesign it.
- Keep deep-star expansion HYG-only for this change.

## Current-state findings
- `viewer-shell.tsx` currently treats `viewerSettings.scopeOptics` as the only optics source for scope projection, quick controls, and deep-star filtering, while main view keeps using the wide camera projection without independent optics state.
- `lib/viewer/settings.ts` persists `scopeOptics` and rewrites them on every settings change; there is no non-persisted main-view optics state.
- `lib/astronomy/stars.ts` only applies optics filtering and `scopeRender` metadata when `scopeModeEnabled` is true, so main view cannot use the same optics pipeline today.
- `lib/viewer/scope-optics.ts` currently couples magnification into limiting-magnitude/render math, which conflicts with the new rule that magnification changes FOV/projection only.
- `viewer-shell.tsx` only enables HYG deep-star requests when `scopeModeActive` is true, and tile selection/projection are derived from the square lens viewport plus scope FOV. Main view therefore has no deep-star request path today.
- Center-lock currently reuses `pickCenterLockedCandidate` with `rankScore` from label ranking, and scope deep stars are resolved in a separate fallback branch, which does not satisfy the required distance -> brightness -> id ordering across all visible objects.

## Implementation milestones

### Milestone 1: Split state ownership without splitting formulas
- Introduce an explicit runtime-only main-view optics state in `viewer-shell.tsx` with defaults `apertureMm = existing baseline-tuned default`, `magnificationX = 1.0`, and no persistence writes.
- Keep persisted `viewerSettings.scopeOptics` as the scope-mode source of truth.
- Keep scope overlay state (`scopeModeEnabled`, lens diameter, transparency) persisted and independent from the active optics source.
- Add shared helper entry points in `lib/viewer/scope-optics.ts` for:
  - magnification normalization/FOV projection mapping that supports the main-view `0.25x` minimum,
  - aperture-driven deep-star emergence / limiting-magnitude calculations,
  - any shared render-profile metadata still needed by both main and scope paths.
- Preserve existing storage key and backward compatibility for persisted scope settings; legacy `scope.verticalFovDeg` migration must continue to hydrate scope magnification only.

### Milestone 2: Rewire viewer runtime and controls around the active optics source
- In `viewer-shell.tsx`, resolve `activeOptics` from:
  - main-view optics when scope mode is off,
  - persisted scope optics when scope mode is on.
- Apply active magnification only to FOV/projection selection. Remove magnification coupling from deep-star emergence, limiting-magnitude gates, and other visibility decisions.
- Introduce an explicit mode-independent deep-star request context in `viewer-shell.tsx`:
  - `deepStarPresentationMode = main | scope`,
  - request eligibility depends on `observer`, daylight suppression, and active optics behavior, not on scope overlay presentation alone,
  - request center still follows camera pointing,
  - selection radius derives from the active projection FOV plus the active presentation viewport dimensions.
- Keep one shared tile-selection/request pipeline, but feed it different viewport inputs by mode:
  - main view uses the full viewer viewport and active main-view projection,
  - scope mode uses the square lens viewport and scope projection.
- Project loaded HYG deep stars through the active projection profile for main-view participation, while scope mode may continue to also compute scope-lens-circle membership for overlay rendering.
- Keep scope overlay/lens framing optional and presentation-only; request invalidation and scope tile cancellation behavior stays unchanged.
- Make quick optics sliders visible in normal/main view by default and keep their labels/appearance aligned with scope mode. The callback target switches by active mode instead of duplicating separate UI concepts.
- Unify wide-view bright stars and HYG deep stars into one visible-object candidate set for center-lock and labels wherever the active optics pipeline makes them visible.
- Replace the current center-lock reuse of label rank ordering with a dedicated deterministic comparator:
  - smallest angular distance first,
  - then brightest object,
  - then stable object-id ordering.
- Keep label ranking logic separate for label placement; do not let label budgets/type priority redefine center-lock behavior.

### Milestone 3: Lock regression coverage to the new contract
- Update unit coverage in:
  - `tests/unit/scope-optics.test.ts` for `0.25x` minimum, `1.0x` main default mapping, and magnification no longer affecting emergence thresholds.
  - `tests/unit/viewer-settings.test.tsx` for main-view non-persistence, scope-mode persistence, and legacy scope migration compatibility.
  - `tests/unit/projection-camera.test.ts` or equivalent viewer helper coverage for the new center-lock ordering.
  - `tests/unit/celestial-layer.test.ts` and relevant scope tests for optics metadata/filtering now being shared outside scope presentation.
- Update integration/viewer coverage in:
  - `tests/unit/viewer-shell.test.ts`,
  - `tests/unit/viewer-shell-celestial.test.ts`,
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`,
  - `tests/unit/settings-sheet.test.tsx`.
- Extend e2e coverage for:
  - main-view sliders/defaults on load,
  - reload resetting main-view optics but preserving scope-mode optics,
  - mode switching preserving independent values while re-binding the same controls,
  - deterministic center-lock behavior when deep stars overlap other visible objects.
- Run the relevant Vitest and Playwright slices after implementation and record pass/fail outcomes in the implementation/test phases.

## Interface definitions
- `MainViewOpticsState`
  - Runtime-only object owned by `viewer-shell.tsx`.
  - Fields: `apertureMm`, `magnificationX`.
  - No writes to local storage.
- `ScopeOptics`
  - Persisted viewer setting.
  - Fields remain `apertureMm`, `magnificationX`, `transparencyPct`.
  - Backward-compatible reader/writer behavior stays intact.
- `resolveActiveOptics(mode, mainOptics, scopeOptics)`
  - Shared viewer-level selection that feeds projection, deep-star filtering, and control values.
  - Presentation-only fields such as scope transparency/lens diameter remain separate from active-optics selection.
- `DeepStarRequestContext`
  - Viewer-owned runtime input for HYG requests and projection.
  - Fields: `presentationMode`, `verticalFovDeg`, `viewportWidth`, `viewportHeight`, `pointingCenter`, `optics`, `daylightSuppressed`.
  - Main view and scope mode both use this contract so request gating, tile selection, and projection are no longer implicitly tied to `scopeModeActive`.
- `CenterLockComparable`
  - Candidate data passed to center-lock ranking must include `id`, `angularDistanceDeg`, and a deterministic brightness metric derivable from the visible object/deep-star data.
  - Label rank score is not part of this comparator.

## Compatibility and migration notes
- No storage-key rotation is planned.
- Persisted scope settings remain canonical for scope mode; legacy `scope.verticalFovDeg` payloads still migrate into scope magnification.
- Main-view optics must not be written to persistence even if the runtime shape is extended locally.
- Existing UX labels remain unchanged; only the active callback target and default visibility rules change.

## Regression controls
- Preserve current scope request invalidation/cancellation and do not introduce extra fetch passes for deep-star tiles.
- Reuse shared optics helpers instead of forking main/scope-specific math.
- Keep scope overlay toggling independent from whether optics behavior is active.
- Reuse the existing tile-selection helper with an explicit request context so main-view deep-star loading changes inputs, not the request lifecycle contract.
- Ensure HYG deep stars only participate when visible under the active optics rules; do not expand to other catalogs.
- Keep label placement budgets and scope marker rendering stable except where required by the new active-optics and center-lock rules.

## Risks and mitigations
- Risk: hidden magnification coupling survives in render/filter helpers and violates the FOV-only requirement.
  - Mitigation: explicitly audit `scope-optics.ts`, `lib/astronomy/stars.ts`, and viewer marker-opacity/render helpers; add tests that hold emergence constant while magnification changes.
- Risk: main-view deep-star loading could accidentally stay scoped to the lens-overlay geometry and silently miss required objects or over-fetch tiles.
  - Mitigation: make request gating and selection radius depend on the explicit deep-star request context, then add tests covering main-view tile selection, request invalidation, and deep-star center-lock participation outside scope mode.
- Risk: adding main optics into the wrong state bucket causes accidental persistence or stale hydration behavior.
  - Mitigation: keep main-view optics as viewer runtime state, not storage schema, and add reload tests that prove reset-to-default behavior.
- Risk: center-lock regressions or flicker if label rank and center-lock continue sharing ordering rules.
  - Mitigation: isolate center-lock comparator, test exact ties for brightness and id ordering, and keep label ranking tests separate.
- Risk: scope-mode regressions from over-broad rewiring.
  - Mitigation: reuse the existing scope overlay/request lifecycle and keep persisted scope controls/data contracts unchanged.

## Rollback
- Revert active-optics selector changes and restore scope-only optics wiring if center-lock or performance regressions appear.
- Keep storage compatibility so rollback does not require a data migration.
- Because main-view optics are intentionally non-persisted, rollback does not need storage cleanup.
