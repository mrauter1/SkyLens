# Test Strategy

- Task ID: autoloop-task-implement-main-view-hybrid-canvas-70d5075e
- Pair: test
- Phase ID: hybrid-regression-validation
- Phase Directory Key: hybrid-regression-validation
- Phase Title: Rebaseline tests around the hybrid main-view contract
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Main-view canvas draw semantics
  Covered by `SkyLensServerless/tests/unit/main-star-canvas.test.tsx`.
  Checks one-fill-per-star rendering, shared B-V color parity, alpha/radius clamp behavior, and DPR-scaled backing-canvas sizing.

- Shared scope/main deep-star canvas parity
  Covered by `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx` plus the main-view canvas suite.
  Checks the shared compact-core renderer stays aligned for color mapping, radius bounds, and alpha bounds.

- Non-scope deep stars are canvas-only but still logical participants
  Covered by `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`.
  Checks main-view deep stars render on `main-star-canvas`, do not create `sky-object-marker` buttons, still feed `center_only`, `on_objects`, and `top_list` label flows, and keep visible-marker diagnostics DOM-only.

- Scope path remains unchanged
  Covered by `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`.
  Checks scope mode still renders through `scope-star-canvas` / `scope-lens-overlay`, including when `mainViewDeepStarsEnabled` is off.

- Adjacent interaction and settings regressions
  Covered by `SkyLensServerless/tests/unit/viewer-shell.test.ts`, `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`, and `SkyLensServerless/tests/unit/viewer-settings.test.tsx`.
  Checks existing bright-object interaction, label behavior, viewer settings persistence, and related viewer-shell contracts remain intact.

## Preserved invariants checked

- Non-scope deep stars never re-enter interactive DOM marker/button semantics.
- Deep stars stay eligible for center-lock ranking and label candidate generation outside scope mode.
- Scope lens behavior and deep-star rendering contract are unchanged by the main-view split.
- Persisted `mainViewDeepStarsEnabled` behavior still gates main-view catalog work without affecting scope rendering.

## Edge cases and failure paths

- Invalid or out-of-range alpha/radius inputs clamp deterministically.
- Device-pixel ratio changes resize the canvas backing store without changing CSS viewport size.
- Below-horizon and limiting-magnitude-filtered deep stars stay out of canvas output.
- Stale scope tile responses are ignored after scope mode is disabled.

## Flake-risk controls

- Canvas rendering is stabilized with a stubbed 2D context and captured fill calls instead of pixel snapshots.
- Viewer-shell runtime tests stub bounding boxes, network fetches, timers, and local storage to keep ordering deterministic.
- Label assertions check presence of expected object text rather than brittle DOM ordering where ordering is not part of the contract.

## Known gaps

- No browser-level visual snapshot coverage; this phase relies on deterministic unit assertions over canvas draw calls and DOM contracts.
- No new end-to-end coverage was added because it is out of scope for this phase.
