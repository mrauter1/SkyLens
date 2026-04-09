# Main-View Hybrid Renderer Plan

## Objective
Implement the approved hybrid renderer in `SkyLensServerless` so non-scope deep stars render on canvas, interactive/selectable objects remain DOM-based, and existing center-lock, label, optics, and accessibility behavior stays intact everywhere else.

## Confirmed Current Behavior
- `viewer-shell.tsx` already derives `projectedDeepStars` from the scope catalog path and reuses them in both scope and non-scope modes.
- Scope mode already renders deep stars through `ScopeLensOverlay` -> `ScopeStarCanvas`, while bright in-lens objects stay on the DOM overlay path.
- Non-scope mode currently appends `mainViewRenderedDeepStars` into `markerObjects`, so deep stars become `sky-object-marker` buttons and also implicitly feed non-scope labels.
- Center-lock and detail lookups already resolve from the broader projected sets (`projectedObjects` plus `projectedDeepStars`), which is the logical contract to preserve.

## Implementation Contract
### Milestone 1: Add the non-scope star canvas surface
- Introduce a main-view canvas component in `components/viewer/` for full-viewport star points with `pointer-events: none`, `aria-hidden="true"`, and deterministic redraws.
- Reuse the existing deep-star draw semantics from `ScopeStarCanvas`: same B-V color mapping, same alpha clamping, same radius clamping, same DPR-aware sizing.
- Keep the scope canvas public contract unchanged. If draw logic is shared, limit the refactor to a small local primitive rather than a broad abstraction.

### Milestone 2: Split logical object sets from interactive DOM markers
- In `viewer-shell.tsx`, derive `mainViewDeepStarCanvasPoints` from visible non-scope `projectedDeepStars`.
- Replace the current non-scope `markerObjects` contract with an explicit interactive DOM list that excludes deep stars outside scope mode.
- Keep a separate non-scope logical label set that still includes visible deep stars so `center_only`, `on_objects`, and `top_list` keep their current candidate membership.
- Preserve the existing center-lock candidate membership and ranking inputs; only the final rendering surface changes.
- Leave scope mode lens mounting, offsets, optics, and scope star canvas behavior unchanged.

### Milestone 3: Realign tests and validate regressions
- Add focused canvas tests for the new main-view star canvas covering fill count, B-V color parity, alpha/radius clamping, and DPR sizing.
- Update `viewer-shell-scope-runtime` expectations so non-scope deep stars are canvas-only while still participating in center-lock and label rendering.
- Keep coverage for the persisted `mainViewDeepStarsEnabled` setting and for scope-mode behavior remaining unchanged.
- Run targeted `vitest` suites first, then full `SkyLensServerless` `vitest run` if the targeted pass is clean.

## Interface Definitions
### Canvas Point Payload
- `id: string`
- `x: number`
- `y: number`
- `bMinusV: number`
- `alpha: number`
- `radius: number`

### Main Canvas Contract
- Inputs: stage `widthPx`, `heightPx`, and the point payload array above.
- Rendering: absolute full-stage canvas under marker/label DOM, no pointer handlers, no accessibility role.
- Output: visual-only deep-star field for non-scope mode; no selection or hover source.

### ViewerShell Data Split
- `projectedDeepStars`: unchanged canonical logical deep-star source.
- `mainViewRenderedDeepStars`: visible non-scope deep stars; still feeds center-lock, labels, and detail resolution.
- `interactiveMarkerObjects`: DOM button list only; excludes non-scope deep stars.
- `labelObjects`: must remain logically complete, not merely equal to the interactive marker list.

## Compatibility Notes
- Intentional behavior change: in non-scope mode, deep stars stop rendering as `sky-object-marker` buttons and therefore no longer originate pointer hover/click interaction.
- Preserved behavior: visible deep stars must still affect center-lock ranking, center-lock chip copy, on-object labels, top-list labels, and active summary/detail lookup when they are the resolved object.
- Preserved behavior: scope mode remains on the existing `ScopeLensOverlay` + `ScopeStarCanvas` path with no lens behavior change.
- No persisted-data, settings-schema, public API, or migration changes are required.

## Regression Risks And Controls
- Risk: label regressions if non-scope labels are still sourced from the DOM marker list after deep stars are removed.
  Control: keep a dedicated logical label array for non-scope mode that still includes visible deep stars.
- Risk: center-lock drift if the candidate set narrows to interactive markers.
  Control: leave center-lock inputs based on the full visible projected sets.
- Risk: visual mismatch between scope and main-view deep stars.
  Control: reuse the same B-V, alpha, and radius semantics as the scope canvas path.
- Risk: accidental scope-mode regression from shared-canvas refactoring.
  Control: preserve `ScopeStarCanvas` outward props/test id and validate scope runtime tests unchanged.
- Risk: misleading diagnostics after marker count drops.
  Control: treat visible-marker diagnostics as DOM-marker counts only; do not reintroduce deep stars into that list for debug copy.

## Validation Plan
- Targeted suites:
  - `tests/unit/scope-star-canvas.test.tsx` and new main-view canvas tests
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - `tests/unit/viewer-shell.test.ts`
  - `tests/unit/viewer-shell-celestial.test.ts`
  - `tests/unit/viewer-settings.test.tsx`
- Full suite:
  - `SkyLensServerless`: `vitest run`
- Manual smoke checks if needed after tests:
  - Scope mode on/off transition keeps lens rendering unchanged.
  - Non-scope deep stars render visually without interactive buttons.
  - Bright-object click/hover/focus behavior stays unchanged.

## Rollback
- Revert the non-scope canvas mount and restore non-scope deep stars to the DOM marker list if the hybrid path causes correctness regressions.
- Keep any shared canvas refactor small enough that `ScopeStarCanvas` can be restored independently without touching viewer-state logic.
