# Implementation Notes

- Task ID: autoloop-task-implement-main-view-hybrid-canvas-70d5075e
- Pair: implement
- Phase ID: main-view-canvas-runtime
- Phase Directory Key: main-view-canvas-runtime
- Phase Title: Split non-scope deep stars onto a visual-only canvas surface
- Scope: phase-local producer artifact

## Files changed
- `SkyLensServerless/components/viewer/star-point-canvas.tsx`
- `SkyLensServerless/components/viewer/main-star-canvas.tsx`
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/tests/unit/main-star-canvas.test.tsx`
- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`

## Symbols touched
- `StarPointCanvas`
- `MainStarCanvas`
- `ScopeStarCanvas`
- `ViewerShell`
- `toDeepStarCanvasPoint`

## Checklist mapping
- Milestone 1: added full-stage main-view canvas surface and preserved pointer-inert / aria-hidden behavior.
- Milestone 2: split non-scope interactive DOM markers from deep-star logical membership in `viewer-shell.tsx`.
- Milestone 3: added main-view canvas tests and updated runtime tests for canvas-only non-scope deep stars.

## Preserved invariants
- Scope mode still renders deep stars through `ScopeLensOverlay` and `ScopeStarCanvas`.
- Center-lock candidate membership still includes visible deep stars in non-scope mode.
- Label candidate membership still includes visible deep stars in non-scope mode for `center_only`, `on_objects`, and `top_list`.
- Non-deep-star interactive markers keep existing DOM button semantics and accessibility behavior.
- Main-view and scope-view deep-star color, alpha, and radius semantics stay aligned through a shared canvas renderer and shared deep-star point mapping.

## Intended behavior changes
- Non-scope deep stars no longer emit `sky-object-marker` DOM buttons.
- Non-scope deep stars now render on `main-star-canvas` only.

## Known non-changes
- No settings schema, feature-flag, optics math, scope tile selection, or scope lens overlay contract changes.
- No changes to deep-star catalog loading beyond the existing runtime fetch path.

## Assumptions
- Existing test-side scope tile artifact generation is unrelated workspace noise and not part of this feature.

## Expected side effects
- Visible-marker diagnostics now reflect only interactive DOM markers outside scope mode, matching the shared decision log.

## Validation performed
- `npm ci`
- `npm test -- tests/unit/main-star-canvas.test.tsx tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-settings.test.tsx`
- `npm test`

## Deduplication / centralization
- Centralized star-point canvas drawing into `StarPointCanvas`.
- Centralized deep-star canvas-point derivation in `toDeepStarCanvasPoint` to keep scope/main parity local to `viewer-shell.tsx`.
