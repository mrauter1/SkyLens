# Test Strategy

- Task ID: autoloop-task-implement-skylensserverless-prd-ar-00a5be41
- Pair: test
- Phase ID: validation-and-hardening
- Phase Directory Key: validation-and-hardening
- Phase Title: Validation And Hardening
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Scope persistence in demo mode
  - `tests/e2e/demo.spec.ts`
  - Covers enabling scope, persisted reload state, and visible lens restoration.
- Fallback/manual-pan scope availability
  - `tests/e2e/permissions.spec.ts`
  - Covers manual-pan fallback enabling scope from the mobile settings surface.
- Wide-view invariants outside the lens
  - `tests/unit/viewer-shell-celestial.test.ts`
  - Covers scope bright-object center-lock switching without mutating wide-stage highlight state and verifies lens occlusion DOM ordering.
- Dense-scope runtime and stale-response behavior
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Covers named deep-star center-lock, canvas-only rendering, and stale tile-response invalidation after scope disable.
- Lens geometry / click-shield contract
  - `tests/unit/scope-lens-overlay.test.tsx`
  - Covers overlay frame, hit area, star canvas, and bright-object marker rendering.
- Scope settings synchronization and persistence
  - `tests/unit/viewer-settings.test.tsx`
  - `tests/unit/settings-sheet.test.tsx`
  - Covers normalized defaults/clamping and synchronized settings-sheet / quick-action behavior.
- Build and dataset compatibility
  - `package.json` scripts `scope:data:build:dev`, `scope:data:verify`, `build`
  - Producer validation reran these commands successfully for this phase.

## Preserved invariants checked

- `/view` remains the only viewer route.
- Scope stays hidden when blocked/inactive states do not permit scope controls.
- Wide-view labels, markers, and ranking remain unchanged outside the lens.
- No WebGL, WebGPU, or hardware-zoom paths were introduced.

## Edge cases and failure paths

- Reload with persisted scope enabled.
- Manual-pan fallback with scope enabled from mobile controls.
- Stale scope tile responses after scope disable.
- Scope overlay rendering order relative to wide markers/labels.

## Validation executed this turn

- No new repository test files were required; the existing validation-and-hardening coverage already matched the phase contract.
- Producer reran:
  - `npm run lint`
  - `npm run test`
  - `npm run test -- tests/unit/viewer-shell-celestial.test.ts`
  - `npm run test -- tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/scope-lens-overlay.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx`
  - `npm run test:e2e -- tests/e2e/demo.spec.ts tests/e2e/permissions.spec.ts`
  - `npm run scope:data:build:dev`
  - `npm run scope:data:verify`
  - `npm run build`

## Flake risks and stabilization

- Playwright required local Chromium plus Linux runtime dependencies in this container before browser-backed tests could run; after environment setup, the same scoped e2e suite passed.
- Existing lint output still includes five pre-existing `react-hooks/exhaustive-deps` warnings in `components/viewer/viewer-shell.tsx`; this turn did not widen or normalize those warnings.

## Known gaps

- No new test code was added in this turn because the current repo test surface already covers the scoped behaviors and the producer turn did not land new product logic.
