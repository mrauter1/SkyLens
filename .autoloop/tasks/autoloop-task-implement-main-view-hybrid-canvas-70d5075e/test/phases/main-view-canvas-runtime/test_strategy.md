# Test Strategy

- Task ID: autoloop-task-implement-main-view-hybrid-canvas-70d5075e
- Pair: test
- Phase ID: main-view-canvas-runtime
- Phase Directory Key: main-view-canvas-runtime
- Phase Title: Split non-scope deep stars onto a visual-only canvas surface
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- Non-scope deep stars render on a pointer-inert main-view canvas with shared B-V, alpha/radius clamp, and DPR sizing semantics.
  Coverage: `tests/unit/main-star-canvas.test.tsx`
- Scope-mode deep-star canvas contract remains unchanged while sharing the same draw primitive.
  Coverage: `tests/unit/scope-star-canvas.test.tsx`
- Non-scope deep stars no longer emit `sky-object-marker` DOM buttons.
  Coverage: `tests/unit/viewer-shell-scope-runtime.test.tsx`
- Non-scope deep stars still participate in `center_only`, `on_objects`, and `top_list` label flows.
  Coverage: `tests/unit/viewer-shell-scope-runtime.test.tsx`
- Visible-marker diagnostics remain DOM-marker-only after deep stars move to canvas.
  Coverage: `tests/unit/viewer-shell-scope-runtime.test.tsx`
- Scope mode still uses the existing lens overlay canvas path and keeps optics-driven deep-star behavior unchanged.
  Coverage: `tests/unit/viewer-shell-scope-runtime.test.tsx`, `tests/unit/scope-star-canvas.test.tsx`

## Preserved invariants checked
- Center-lock winner still resolves from the full logical visible set, not the interactive DOM marker list.
- Main-view deep-star color mapping matches scope canvas behavior.
- Optics-driven deep-star reveal behavior still works in both non-scope and scope paths.
- Scope bright-object overlay behavior is unchanged.

## Edge cases covered
- Invalid deep-star alpha and radius inputs clamp deterministically.
- Wider apertures reveal more main-view deep stars without reintroducing DOM markers.
- Brighter non-deep objects can still beat deep stars in center-lock ordering after the surface split.

## Failure-path / flake controls
- Canvas tests stub `HTMLCanvasElement.getContext` to avoid browser-specific rendering variance.
- Viewer runtime tests use deterministic demo scenarios, mocked fetch responses, mocked geometry bounds, and explicit panel-opening before asserting diagnostics copy that only appears on that surface.

## Known gaps
- No manual browser-performance measurement is encoded in unit tests; runtime coverage here remains correctness-focused rather than benchmarking.
