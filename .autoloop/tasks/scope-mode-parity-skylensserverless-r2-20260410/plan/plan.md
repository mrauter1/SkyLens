# Scope Mode Parity Plan (SkyLensServerless)

## Scope
- Restore scope-mode object-class parity with normal view for interactive sky elements (constellations, satellites, aircraft, stars, planets, Sun/Moon where applicable).
- Keep scope optics distinct (scope projection profile, lens FOV, magnification/aperture-driven behavior) and avoid collapsing scope rendering into normal-view optics.
- Ensure scope-mode label candidate construction (on-object and top-list) uses the parity marker set rather than a bright-only subset.
- Keep normal-view behavior unchanged.

## Baseline And Gap Summary
- `SkyLensServerless/components/viewer/viewer-shell.tsx` already contains stage projection and scope projection branches, plus shared `resolveMarkerEligibleProjectedObjects(...)` filtering.
- Scope lens overlay markers are rendered from scope-projected objects (`ScopeLensOverlay`), while wide stage DOM markers are still sourced from the normal-view interactive marker set and are sized in scope mode with `baseEffectiveVerticalFovDeg`; this is the primary optics/parity mismatch surface.
- Scope label pipelines already route through scope-mode marker candidates, but this must remain explicitly protected when rewiring marker/projection ownership.

## Milestone
### Ship one coherent scope parity slice
- Align marker-eligible object derivation so both normal and scope branches are built from the same class-parity source set.
- Split marker projection ownership cleanly into stage-active and lens-active variants so scope mode does not inherit normal-view projection/sizing baselines.
- Keep scope labels/top-list tied to scope-active marker candidates plus in-lens deep stars.
- Add focused regression coverage for parity classes and scope-FOV sizing behavior.

## Interfaces And Boundaries
- Primary edit surface:
  - `SkyLensServerless/components/viewer/viewer-shell.tsx`
- Test edit surface:
  - `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- Internal interfaces to preserve:
  - `resolveMarkerEligibleProjectedObjects(...)` remains the canonical daylight/selection/center-lock eligibility gate.
  - `ScopeLensOverlayObject` contract remains unchanged; only its source list and sizing inputs may change.
  - Existing projection helpers (`projectWorldPointToScreenWithProfile`, `offsetScopeProjectionToStage`) remain the projection primitives.
- Out of scope:
  - New settings/state schema changes.
  - API/data contract changes.
  - Refactors outside scope marker/projection/label pipeline.

## Implementation Contract
1. Marker-class parity source
- Build (or retain) a single marker-parity source object set before stage-vs-scope projection branching.
- Do not reintroduce bright-only filtering for scope marker classes.

2. Stage vs lens projection ownership
- Keep scope lens markers derived from scope-projected objects and lens-circle gating.
- Rewire stage marker rendering inputs so scope-mode stage markers are sourced from scope-active projection outputs where required by parity/optics behavior, not from normal-view-only projected objects.
- In scope mode, use scope-active effective FOV for marker sizing where scope optics are expected to drive apparent scale; preserve normal-mode sizing baseline when scope mode is off.

3. Scope labels and top-list parity
- Keep `labelObjects`/top-list candidates in scope mode sourced from the scope-active marker set plus eligible in-lens deep stars.
- Preserve existing center-lock prioritization semantics.

4. Normal-view compatibility
- No change to non-scope deep-star canvas behavior, normal-view marker eligibility, or normal-view label modes.

## Compatibility Notes
- No public API, route, or persisted setting contract changes.
- Visual behavior change is intentional and limited to scope mode parity/optics consistency.
- Existing test selectors (including `scope-bright-object-marker`) remain stable unless a test-safe rename is explicitly required.

## Validation
- Update/add targeted unit assertions for:
  - scope mode includes non-bright classes (aircraft/satellite/constellation where applicable) in scope lens markers.
  - scope-mode top-list and on-object labels include the same relevant classes as normal mode candidate sets.
  - non-bright scope markers are sized by scope optics/FOV rather than wide-stage baseline.
  - normal mode behavior remains unchanged for marker set and label candidate composition.
- Run focused tests first:
  - `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- Then run full unit suite in `SkyLensServerless` (`npm run test`).

## Regression Prevention
- Preserve invariants:
  - scope mode and normal mode share object-class eligibility intent.
  - scope mode still uses scope-specific projection/FOV optics.
  - center-lock, selection highlighting, and daylight suppression gates remain consistent.
  - deep-star inclusion remains mode-correct (in-lens when scope mode on, stage canvas when off).
- Keep changes localized to existing viewer-shell dataflow; avoid new generic abstraction layers.

## Risk Register
- R1: Rewiring marker ownership could desynchronize center-lock and selected-object highlighting.
  - Control: assert center-lock continuity and selected/highlight classes in scope and normal modes.
- R2: Scope-mode sizing changes could unintentionally alter normal-mode marker scale.
  - Control: gate active-FOV sizing by mode and keep non-scope baseline path untouched.
- R3: Label candidate rewiring could duplicate or omit deep-star candidates.
  - Control: preserve explicit mode branches for deep-star inclusion and verify top-list/on-object counts.
- R4: Scope lens parity changes could regress overlay ordering/occlusion assumptions.
  - Control: retain existing overlay render order and keep ordering tests green.

## Rollback
- Revert the `viewer-shell.tsx` marker/projection/sizing rewiring while retaining unrelated scope optics work.
- Restore prior scope marker source wiring if parity changes cause center-lock, label, or overlay regressions.
- Keep rollback scoped to viewer-shell and associated parity tests only.
