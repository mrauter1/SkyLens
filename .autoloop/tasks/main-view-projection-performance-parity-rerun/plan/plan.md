# Main-View Projection Performance Parity Plan

## Scope
- Implement the task in `AUTOLOOP_TASK_MAIN_VIEW_PROJECTION_PERF_PARITY.md` without widening scope.
- Preserve scope-mode behavior and existing public viewer flows unless the task explicitly changes them.

## Current Findings
- `viewer-shell.tsx` already supports main-view magnification and main-view deep-star loading, but non-scope projection still mixes wide-profile and explicit-profile call sites.
- Main-view profile projection paths can omit camera source dimensions unless each caller passes them manually, which risks marker/video drift when camera aspect ratio differs from the viewport.
- Constellation overlays accept an override projector, but `buildVisibleConstellations()` still validates the full catalog on every build.
- Main-view deep stars currently piggyback on scope runtime data and optics without a dedicated persisted toggle, adaptive workload governor, or dev diagnostics.
- B-V color mapping exists only inside `scope-star-canvas.tsx`, so non-scope deep stars cannot share the same star-color semantics without duplicating logic.

## Implementation Plan

### Milestone 1: Consolidate non-scope projection context and remove hot-path divergence
- In [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx), replace ad hoc non-scope projection branching with one local stage projection context that carries:
  - active non-scope projection profile,
  - viewport width/height,
  - explicit `sourceWidth`/`sourceHeight` from `cameraFrameLayout` when available,
  - shared projector(s) for markers, deep stars, constellation endpoints, and focused aircraft trails.
- Keep scope-lens projection separate so the lens circle, clipping, and scope-only projector stay unchanged.
- In [camera.ts](/workspace/SkyLens/SkyLensServerless/lib/projection/camera.ts), preserve the existing public API, keep source-dimension fallback to viewport dimensions for legacy callers, and strengthen tests around explicit source-dimension propagation and deterministic fallback.
- In [constellations.ts](/workspace/SkyLens/SkyLensServerless/lib/astronomy/constellations.ts), move bundled catalog validation out of `buildVisibleConstellations()` and into one-time module initialization or equivalent cached validation so production frame rendering does not revalidate static data.

### Milestone 2: Add main-view deep-star governance without changing scope behavior
- Extend persisted viewer settings in [settings.ts](/workspace/SkyLens/SkyLensServerless/lib/viewer/settings.ts) with a main-view deep-star enable flag and any minimal persisted fields required to support deterministic governance while keeping older stored payloads readable.
- Extend [settings-sheet.tsx](/workspace/SkyLens/SkyLensServerless/components/settings/settings-sheet.tsx) so the main-view toggle is user-visible and wired through existing settings update patterns.
- In [scope-optics.ts](/workspace/SkyLens/SkyLensServerless/lib/viewer/scope-optics.ts) and [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx), add a small explicit governor contract:
  - named quality tiers backed by constants,
  - fixed thresholds plus hysteresis,
  - deterministic precedence ordering,
  - conservative startup baseline,
  - no impact on scope-mode rendering rules.
- Make `getDefaultMainViewOptics()` plus the governor’s initial tier the only startup baseline owners for main-view deep-star workload. Document an explicit numeric min/max startup visible-deep-star count band for the deterministic startup fixture used by the scope-runtime tests, and enforce that band before any user optics changes.
- Apply precedence in this exact order:
  - hard-off gates first: no observer, stars layer disabled, daylight suppression, main-view deep-stars toggle off,
  - governor tier selection second, using only the configured thresholds and hysteresis while hard-off gates are false,
  - center-lock/selected exceptions third, so only those objects may surface main-view markers/labels while other deep stars stay marker/label silent,
  - diagnostics reporting last, mirroring the same highest-precedence rule or last tier transition reason that determined the current state.
- Ensure main-view deep stars contribute zero non-focused labels/markers, while still participating in center-lock and focused detail behavior when the hard-off gates above do not disable the feature entirely.

### Milestone 3: Share star-color semantics and expose dev diagnostics
- Extract the B-V color mapping used by [scope-star-canvas.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/scope-star-canvas.tsx) into a shared helper in an existing viewer/astronomy utility location so scope canvas rendering and non-scope deep-star rendering use the same bands.
- Update non-scope deep-star marker styling in [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx) to consume the shared color helper only where main-view deep stars are enabled.
- Add development-only diagnostics in [viewer-shell.tsx](/workspace/SkyLens/SkyLensServerless/components/viewer/viewer-shell.tsx) alongside existing orientation diagnostics to show:
  - current main-view deep-star quality tier,
  - decision source / precedence winner,
  - most recent transition reason.
- Keep diagnostics out of production builds and avoid new runtime polling or logging infrastructure.

### Milestone 4: Lock behavior with deterministic tests
- Update or add targeted tests in:
  - [projection-camera.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/projection-camera.test.ts)
  - [celestial-layer.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/celestial-layer.test.ts)
  - [viewer-shell-celestial.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts)
  - [viewer-shell-scope-runtime.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx)
  - [viewer-shell.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-shell.test.ts)
  - [viewer-settings.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/viewer-settings.test.tsx)
  - [settings-sheet.test.tsx](/workspace/SkyLens/SkyLensServerless/tests/unit/settings-sheet.test.tsx)
  - [scope-optics.test.ts](/workspace/SkyLens/SkyLensServerless/tests/unit/scope-optics.test.ts)
- Required coverage:
  - explicit source-dimension propagation and fallback,
  - subpixel alignment parity for markers, deep stars, constellation endpoints, and focused trails under main-view magnification,
  - scope behavior unchanged,
  - deep-stars-disabled mode reduces deep-star work,
  - deterministic governor thresholds, hysteresis, precedence, and conservative startup baseline,
  - explicit numeric startup visible-deep-star count band documentation and enforcement,
  - shared B-V color behavior in non-scope mode,
  - constellation validation removed from per-frame production hot path.

## Interface Notes
- `ProjectViewport` remains the projection boundary; implementation should route all non-scope consumers through one caller-owned viewport/context instead of adding parallel projection APIs.
- Viewer settings storage schema changes must default safely when fields are absent, malformed, or coming from older payloads.
- Scope-specific lens rendering interfaces should not be generalized; keep reuse local to the non-scope stage path.

## Compatibility / Migration
- Local storage compatibility is required. New settings must default to the intended conservative behavior when missing and must not break older stored payloads.
- No persisted data migration step is needed beyond tolerant reads and normalized writes.
- No public API, CLI, or server contract changes are expected.

## Regression Controls
- Preserve current scope-mode projection, clipping, label, and optics semantics byte-for-byte where possible.
- Keep main-view magnification projection-only; do not couple it to new aperture-driven render math outside the intended deep-star workload governor.
- Use one shared non-scope projector for every overlay/marker/deep-star path that must stay visually aligned.
- Keep constellation catalog validation eager/cached rather than lazy per frame so invalid bundled data still fails loudly outside production hot paths.
- Keep the startup baseline anchored to `getDefaultMainViewOptics()` and the governor’s initial tier so later changes cannot silently increase default startup workload without failing the documented visible-star band tests.

## Validation
- `rg --files SkyLensServerless/tests | head -n 200`
- `cd SkyLensServerless && pnpm install --frozen-lockfile`
- `cd SkyLensServerless && pnpm exec vitest run tests/unit/projection-camera.test.ts tests/unit/celestial-layer.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell.test.ts tests/unit/scope-optics.test.ts`
- `cd SkyLensServerless && pnpm exec vitest run tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx`
- `cd SkyLensServerless && pnpm exec playwright test tests/e2e/demo.spec.ts`
- `cd SkyLensServerless && pnpm exec vitest run tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts`

## Risk Register
- `R1`: A remaining non-scope caller bypasses the shared projector and reintroduces overlay drift.
  Mitigation: centralize the stage projection call shape in `viewer-shell.tsx` and assert parity in unit tests for each consumer type.
- `R2`: Governor hysteresis oscillates or hides expected focused stars.
  Mitigation: encode precedence and transition reasons explicitly, test threshold edges deterministically, and keep focus/selection exceptions explicit.
- `R3`: Storage changes regress existing viewer settings.
  Mitigation: read new fields as optional, normalize aggressively, and cover legacy payloads in settings tests.
- `R4`: Hoisting constellation validation weakens failure visibility for bad bundled data.
  Mitigation: perform validation once at module load or equivalent cached init and keep catalog contract tests intact.

## Rollback
- Revert the main-view deep-star governor/toggle changes independently from projection consolidation if governance proves unstable.
- Revert the shared non-scope projection helper/context independently from UI-setting changes if only visual parity regresses.
- Keep constellation validation hoisting isolated so it can be reverted without touching rendering semantics if startup behavior changes unexpectedly.
