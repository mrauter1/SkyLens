# Scope-mode review fixes plan (SkyLensServerless)

## Intent and invariants
- Scope lens keeps parity object classes and scope optics behavior.
- Wide stage keeps wide-context semantics in scope mode: object eligibility, projection baseline, and center-lock styling ownership.
- Scope-only magnification/projection effects remain confined to lens rendering and scope-only summaries.
- Keep selector compatibility (`scope-bright-object-marker`) and avoid unrelated refactors.

## In scope
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/viewer-settings.test.tsx` (root app) and minimal related doc wording if needed for explicit aperture-disabled semantics

## Out of scope
- Scope dataset generation, tiling, and catalog formats.
- UI redesign, class renames, or broad settings-schema migrations.
- Non-viewer behavioral changes unrelated to scope parity regressions.

## Milestones
1. Lock runtime ownership boundaries in `viewer-shell.tsx`.
- Ensure stage `interactiveMarkerObjects` remains tied to wide-stage eligible markers in scope mode.
- Ensure stage marker sizing always uses stage baseline projection/FOV (`stageProjectionProfile` path), not scope magnified FOV.
- Ensure stage marker highlight/focus style uses wide-scene center-lock ownership (`stageCenterLockedObjectId`) in scope mode.
- Ensure selected/hovered summary and motion-affordance coordinates resolve from the same interaction surface/projection source used by the triggering marker.

2. Correct regression-encoding tests and add parity guards.
- Update scope-runtime marker-size expectation to enforce split behavior: lens magnified sizing vs stage baseline sizing (not forced equality).
- Add/adjust celestial tests to lock:
  - stage markers remain visible and interactive outside lens while scope mode is on,
  - stage highlighting tracks wide-scene center-lock winner,
  - selected/hovered summary + motion-affordance coordinates stay aligned with interaction projection surface.

3. Resolve settings expectation/doc alignment.
- Reconcile root `tests/unit/viewer-settings.test.tsx` with intended rule for scope aperture when scope mode is disabled.
- Preferred supposition from current behavior + existing task wording: keep disabled-mode aperture clamp-to-100 behavior explicit in tests and docs, scoped only to disabled mode normalization.

4. Validate and gate.
- Run focused test suites for touched behavior and settings:
  - root: `npm test -- tests/unit/viewer-settings.test.tsx`
  - serverless: `npm test -- tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-settings.test.tsx`
- If any failure indicates ownership bleed between stage/scope projections, rollback to previous invariant and reapply with narrower diff.

## Interface and behavior contract
- Stage marker source contract:
  - Input: wide projected objects (`projectedObjects` + applicable wide deep-star set).
  - Visibility/filtering: `resolveMarkerEligibleProjectedObjects(..., { centerLockedObjectId: stageCenterLockedObjectId, selectedObjectId })`.
- Scope lens marker source contract:
  - Input: scope-projected, lens-clipped objects only.
  - Visual-only overlay (`scope-bright-object-marker`) with scope-specific size/opacity.
- Summary object contract:
  - `resolveInteractionSummaryObject` must return projection coordinates from the same surface (`stage` vs `scope`) as interaction source; downstream motion-affordance uses these coordinates unchanged.

## Regression-risk notes
- High risk: reintroducing stage narrowing to lens-only objects in scope mode.
- High risk: accidentally using scope effective FOV for stage marker size calculations.
- Medium risk: stale interaction surface state causing summary/motion affordance drift.
- Medium risk: tests asserting previous regression behavior (false confidence).

## Risk register and controls
- Risk: center-lock ownership split between wide/scope objects causes inconsistent highlight.
  - Control: explicit tests that compare center-lock chip winner and highlighted stage marker class in scope mode.
- Risk: coordinate mismatch between selected/hovered summary and marker position.
  - Control: test asserts selected/hovered detail and motion affordance line/trail anchor to same projected marker coordinates.
- Risk: settings ambiguity drifts in future.
  - Control: one explicit test/doc statement for disabled-mode aperture normalization rule.

## Compatibility and rollback
- Compatibility: no selector/API/schema break expected; preserve `scope-bright-object-marker`.
- Rollback: revert touched runtime/test hunks together; do not keep partial runtime/test mismatch.
