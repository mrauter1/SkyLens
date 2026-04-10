# Scope-Mode Review Fix Plan

## Scope
- Apply the reviewed scope-mode parity fixes in `SkyLensServerless` without changing unrelated viewer behavior.
- Keep scope optics effects confined to lens rendering; keep wide-stage rendering, interaction, sizing, and highlight ownership on the wide-stage baseline.
- Reconcile the root `tests/unit/viewer-settings.test.tsx` aperture expectation with existing normalization behavior, without widening this task into broader settings redesign.

## Relevant Surfaces
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
- `tests/unit/viewer-settings.test.tsx`
- `lib/viewer/settings.ts`

## Implementation Plan
1. Restore wide-stage ownership in scope mode inside `SkyLensServerless/components/viewer/viewer-shell.tsx`.
   - Keep stage `interactiveMarkerObjects` sourced from the full wide-stage eligible marker set even when scope mode is active.
   - Keep stage marker sizing on the stage baseline FOV/profile instead of the scope-magnified FOV.
   - Keep stage marker visual focus/highlight derived from the wide-scene center-lock winner, not the scope center-lock winner.
   - Preserve current lens overlay behavior: scope lens marker set, scope sizing, and scope center-lock styling remain scope-specific.
2. Make selected/hovered summary state projection-consistent in scope mode.
   - Separate “which object is active” from “which projection surface supplies its coordinates”.
   - When interaction comes from a scope-space marker/lens surface, ensure summary card and motion-affordance coordinates use the matching scope projection projected onto the stage.
   - Keep non-scope interactions and non-scope mode behavior unchanged.
3. Correct regression tests to encode the intended split.
   - Update `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx` so marker-size expectations assert: lens markers magnify with scope optics, stage markers stay on the wide-stage baseline.
   - Update/add `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts` coverage for:
     - stage markers remaining visible/interactable outside the lens in scope mode,
     - stage highlight ownership following wide-scene center lock,
     - motion-affordance / selected-summary coordinates staying aligned with the interaction projection surface.
4. Reconcile root settings expectation with existing business logic.
   - `lib/viewer/settings.ts` currently clamps `scopeOptics.apertureMm` to `100` when `scopeModeEnabled` is false.
   - Treat that clamp as the current intended behavior unless implementer finds contrary authoritative clarification.
   - Keep `tests/unit/viewer-settings.test.tsx` aligned with that behavior and update any adjacent test wording/comments if needed.

## Interfaces And Invariants
- Stage markers in scope mode continue to use wide-stage projection semantics:
  - candidate set = full wide-stage eligible markers,
  - size baseline = stage/wide FOV,
  - active/highlight owner = wide-scene center lock.
- Scope lens overlay continues to use scope semantics:
  - candidate set = scope-visible marker objects plus scope deep stars as already intended,
  - size baseline = scope lens FOV,
  - active/highlight owner = scope center lock.
- Selected/hovered detail presentation must use coordinates from the same projection surface that produced the active interaction target.
- Preserve selector compatibility for `scope-bright-object-marker`.

## Compatibility Notes
- No public API, storage schema, or selector rename is planned.
- Root settings behavior remains backward-compatible by preserving the existing disabled-scope aperture clamp unless an authoritative clarification overrides it.

## Regression Risks
- Reusing the wrong marker collection can silently break hover clearing, clickability outside the lens, or focus styling.
- Mixing wide and scope projections for one active object can cause summary cards and motion affordances to drift from the visible marker.
- Changing stage sizing inputs can regress normal-mode marker sizes if the stage/lens FOV split is not kept explicit.

## Validation
- Run focused tests covering the touched behavior:
  - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
  - `tests/unit/viewer-settings.test.tsx`
- Add any narrowly targeted assertion updates needed to prove:
  - stage markers stay visible outside the scope lens,
  - stage sizing stays wide-baseline while lens sizing remains magnified,
  - stage highlight follows wide center lock,
  - active summary / motion-affordance coordinates align with the active interaction surface,
  - disabled-scope aperture clamp behavior remains explicitly covered.

## Rollback
- Revert only the scope-mode viewer-shell parity patch and associated test updates if a new regression appears.
- Do not roll back unrelated optics/settings work outside the touched files.
