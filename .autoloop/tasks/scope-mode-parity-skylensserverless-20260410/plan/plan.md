# Scope Mode Parity Plan

## Goal
Restore scope-mode parity so the scope lens uses the same marker-eligible object classes as normal view while keeping scope-only optics, projection, and magnification behavior intact.

## Planned slice
One implementation phase in `SkyLensServerless/components/viewer/viewer-shell.tsx`, with targeted test updates in the existing scope/runtime and celestial viewer suites.

## Milestones
1. Replace the bright-only scope object gate with a shared marker-eligibility resolver that both normal-view and scope-mode branches can consume.
2. Derive stage and scope-lens projections as separate collections from the same scene objects so each surface uses the correct profile and clipping rules.
3. Rebuild scope center-lock, lens markers, lens active styling, on-object labels, and top-list candidates from the scope marker set plus scope deep stars already supported by optics.
4. Lock the behavior with regression tests for non-bright scope objects, scope label/top-list membership, scope center-lock highlighting, and profile/FOV-specific sizing.

## Interfaces and ownership
- `projectedObjects` remains the stage-projected scene collection for wide-context rendering and interaction.
- Add a local shared resolver for marker-eligible projected objects that preserves existing daylight suppression and selected/center-lock overrides instead of duplicating filters in normal and scope branches.
- Add a scope-projected marker collection for the same eligible object classes, clipped to the lens circle and offset back to stage coordinates only where stage-based layout/selection consumers need it.
- Keep scope deep stars as a separate source, then merge them into scope center-lock and label/top-list candidate assembly after scope marker filtering.
- Ensure scope lens marker visual state uses the widened scope marker set for `centerLockedObjectId` and selection styling instead of keeping any bright-only guard in the lens overlay path.
- Use profile-specific sizing inputs:
  - wide/stage markers keep the stage/wide FOV basis they render against;
  - scope lens markers use `scopeEffectiveVerticalFovDeg` and existing scope extended-object sizing.

## Compatibility
- No public API, settings schema, persistence, or routing changes.
- Normal-view behavior must remain unchanged.
- Scope overlay ordering stays unchanged: wide lines/markers/labels render below the lens overlay, and only the lens-specific object set changes.

## Regression controls
- Preserve current daylight suppression semantics; parity means matching normal-view class eligibility, not broadening visibility rules beyond existing suppression/override behavior.
- Preserve wide-scene center-lock/highlight behavior for stage markers while allowing scope center-lock candidates to come from the scope marker set plus deep stars.
- Preserve visual coherence inside the lens: if a non-bright object wins scope center-lock, the corresponding lens marker must receive the same active/center-locked styling path as bright objects.
- Keep deep-star loading, limiting-magnitude gating, and canvas rendering logic unchanged except for the collections that consume their output.
- Validate with focused tests for:
  - scope mode rendering a non-bright object class such as aircraft or satellites inside the lens;
  - scope on-object/top-list labels including those classes when they are in-lens and eligible;
  - scope center-lock using the scope candidate set rather than the old bright-only subset;
  - a non-bright scope center-lock winner receiving active lens styling instead of falling through the old bright-only highlight gate;
  - unchanged normal-view label/top-list and deep-star behavior.

## Risk register
- Shared eligibility drift: moving the filter logic can accidentally change normal-view marker membership. Mitigation: keep the resolver local, reuse the current predicates, and verify normal-view tests still pass.
- Projection mismatch: scope collections can accidentally reuse stage coordinates or FOV when sizing/layout is rebuilt. Mitigation: keep explicit stage vs scope collection names and validate both marker presence and position-sensitive tests.
- Scope-only ranking regressions: widening scope label/top-list candidates can unintentionally change which object wins center-lock or appears first. Mitigation: add assertions that non-bright scope objects participate without altering wide-stage highlight ownership, and that the lens active style follows the widened center-lock winner.

## Rollback
- Revert the shared resolver and scope collection rewiring in `viewer-shell.tsx`.
- Revert the scope parity regression tests added for non-bright markers and label/top-list membership.
