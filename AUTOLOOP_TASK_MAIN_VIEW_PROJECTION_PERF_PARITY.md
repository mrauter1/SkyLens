# Autoloop Task: Main-View Projection, Performance Governance, and Visual Parity

Implement the standalone remediation plan for projection consistency, deep-star performance governance, and non-scope visual parity in `SkyLensServerless`.

## Execution Contract (Required)
- Run with pairs: `plan,implement,test`.
- Use full-auto answers mode.
- Do not set `max_iterations`.
- Do not stop due to idle output; wait for terminal completion.
- Do not implement manually outside autoloop.

## Required Scope
- Projection-path consolidation in non-scope main view.
- Explicit source-dimension propagation + deterministic fallback.
- Shared projection context across markers, deep stars, constellation endpoints, and focused trails.
- Preserve scope branch behavior.
- Add main-view deep-stars toggle + adaptive quality governor with thresholds/hysteresis and precedence rules.
- Add dev diagnostics for quality tier/decision source/transition reason.
- Share B-V star color mapping in non-scope where enabled.
- Ensure constellation validation is not in per-frame production hot path.
- Keep conservative startup optics baseline.

## Canonical files
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/projection/camera.ts`
- `SkyLensServerless/lib/astronomy/constellations.ts`
- `SkyLensServerless/lib/astronomy/stars.ts`
- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/lib/viewer/settings.ts`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx` (or equivalent)

## Validation commands
1. `rg --files SkyLensServerless/tests | head -n 200`
2. `cd SkyLensServerless && pnpm install --frozen-lockfile`
3. `cd SkyLensServerless && pnpm exec vitest run tests/unit/projection-camera.test.ts tests/unit/celestial-layer.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell.test.ts tests/unit/scope-optics.test.ts`
4. `cd SkyLensServerless && pnpm exec vitest run tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx`
5. `cd SkyLensServerless && pnpm exec playwright test tests/e2e/demo.spec.ts` (best effort)
6. `cd SkyLensServerless && pnpm exec vitest run tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts`

## Acceptance highlights
- Unified non-scope projection basis with subpixel overlay alignment tolerance.
- Explicit source-dim behavior test coverage.
- Scope behavior unchanged.
- Deep-stars main-view labels/markers zero unless center-locked/selected.
- Deep-stars-disabled mode cuts deep-star workload.
- Adaptive governor thresholds/hysteresis/precedence covered by deterministic tests.
- Conservative startup visible-star count band documented and enforced in tests.
