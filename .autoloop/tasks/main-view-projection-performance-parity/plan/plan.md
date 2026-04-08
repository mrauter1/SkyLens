# Main-View Projection, Performance Governance, and Visual Parity Plan

## Scope
- Apply only the requested `SkyLensServerless` viewer, projection, astronomy, settings, and test files that participate in main-view projection, deep-star workload control, and non-scope visual parity.
- Prefer the canonical import graph rooted at `SkyLensServerless/components/viewer/viewer-shell.tsx`; do not widen scope into legacy duplicates unless an imported dependency forces it.
- Preserve scope-mode projection, clipping, lens geometry, and persisted scope optics behavior unless the request explicitly calls for shared logic outside the scope-only path.
- Keep `.autoloop/` artifacts out of implementation diffs outside the required planning/test/report files for this task.

## Current-state findings
- `viewer-shell.tsx` already computes camera-frame-aware source dimensions, but non-scope projection is still split between `projectWorldPointToScreen`, `projectWorldPointToScreenWithProfile`, and ad hoc branching, so bright objects, deep stars, constellation endpoints, and focused trails do not all share one render-pass projection basis.
- `camera.ts` recreates frame layout inside each projection helper. That keeps behavior correct, but it does not provide the single reused non-scope projection context the request now requires for correctness and hot-path efficiency.
- `buildVisibleConstellations()` validates the bundled constellation catalog on every call. That is safe but it is still on the production render path and violates the requested hot-path constraint.
- Main-view deep-star participation already exists in `viewer-shell-scope-runtime.test.tsx`, but current main-view behavior still allows deep stars to project and render like ordinary markers instead of staying center-only or selected-only.
- B-V color mapping is isolated inside `components/viewer/scope-star-canvas.tsx`, so non-scope deep-star rendering cannot reuse the same star-color logic today.
- `settings.ts` persists viewer settings without a main-view deep-star preference, and `settings-sheet.tsx` has no surface for the required explicit deep-stars control or diagnostics-oriented behavior source.
- Existing tests already cover source-dimension projection, constellation/marker alignment, main-view deep-star selection, scope runtime, and settings persistence, so the safest plan is to tighten those suites instead of adding parallel validation paths.

## Milestones

### Milestone 1: Consolidate non-scope projection onto one render-pass context
- Add a single non-scope projection context in `camera.ts` or a small viewer-facing helper that captures:
  - effective non-scope vertical FOV,
  - the active non-scope projection profile,
  - viewport width and height,
  - optional source width and height,
  - deterministic fallback to viewport dimensions when source dimensions are absent.
- Build that context once per render pass in `viewer-shell.tsx` and route all non-scope world-to-screen work through it:
  - bright objects,
  - projected deep stars,
  - constellation line endpoints,
  - focused aircraft trail points.
- Preserve the existing scope-only square-lens projection and clipping path; the new shared helper applies only to the non-scope/main-view stage.
- Remove duplicated non-scope projection branches rather than layering another conditional helper on top of the current split.
- Close IC-1, IC-2, and IC-3 in code by making the main-view object path, deep-star path, and overlay/trail path all consume the same camera-frame-aware context.

### Milestone 2: Add main-view deep-star governance and non-scope visual parity
- Extend `ViewerSettings` with a backward-compatible main-view deep-star preference named `deepStarsEnabled`, stored so old payloads still hydrate cleanly.
- Resolve deep-star enablement with explicit precedence:
  - user explicit preference when present,
  - adaptive quality governor result otherwise,
  - device/default heuristic last.
- Keep the governor local and auditable: use explicit named tiers plus a small constant table of tunable knobs and numeric degrade/upgrade thresholds with hysteresis windows instead of a generic scoring system.
- Gate main-view deep-star fetch, tile selection, projection, selection, and rendering from the resolved enablement state so disabled mode removes deep-star workload rather than merely hiding the DOM output.
- Keep main-view startup conservative:
  - retain the current bright-catalog-like startup density,
  - allow deep stars to participate in center-lock when enabled,
  - suppress main-view deep-star markers and labels unless the object is center-locked or selected.
- Share B-V color mapping logic by extracting the color function from `scope-star-canvas.tsx` into a small reusable path consumed by scope canvas rendering and non-scope deep-star markers. Tier-aware degradation may simplify color treatment, but projection and center-lock behavior must stay identical across tiers.
- Expose dev-only diagnostics in `viewer-shell.tsx` for active tier, deep-stars enabled source (`user`, `auto`, `default`), and the latest transition reason.
- Move constellation catalog validation off the hot render path by validating once for the bundled catalog at init and memoizing validation by catalog identity for any non-bundled/test catalog inputs.

### Milestone 3: Lock regression coverage and reporting to the new contract
- Strengthen `projection-camera.test.ts` with explicit source-dimension propagation and fallback assertions for the reusable non-scope projection context.
- Update `celestial-layer.test.ts`, `viewer-shell-celestial.test.ts`, and `viewer-shell.test.ts` to prove:
  - marker, constellation, and trail alignment stays within subpixel tolerance,
  - non-scope projection stays unified under main-view magnification,
  - scope-mode behavior remains unchanged,
  - constellation validation no longer runs per render.
- Update `viewer-shell-scope-runtime.test.tsx` and `scope-optics.test.ts` to prove:
  - deep-stars-disabled mode eliminates fetch/selection/render work,
  - adaptive governor thresholds and hysteresis transitions are deterministic,
  - conservative startup visible-star counts stay within a fixed fixture band,
  - deep-star markers and labels remain absent in main view unless center-locked or selected,
  - tier-aware color degradation does not move projections.
- Update `viewer-settings.test.tsx` and `settings-sheet.tsx` coverage to prove storage compatibility, toggle precedence, and settings-surface wiring for the new preference.
- Run the requested validation commands in the later implementation/test phases and capture PR-note evidence for:
  - before/after projection path summary,
  - IC-1 through IC-4 closure mapping,
  - threshold/transition/precedence proof for the governor,
  - scope-behavior and conservative-startup risk note,
  - environment limitations,
  - confirmation that `.autoloop/` artifacts were excluded from implementation diffs.

## Interface definitions
- `NonScopeProjectionContext`
  - Single render-pass contract for main-view projection.
  - Fields: `profile`, `verticalFovDeg`, `viewportWidth`, `viewportHeight`, `sourceWidth`, `sourceHeight`, and any precomputed frame-layout data needed to avoid repeated per-object recomputation.
  - Consumption: bright objects, deep stars, constellation endpoints, focused trails.
- `projectNonScopeWorldPoint(context, pose, worldPoint)`
  - Shared non-scope world-to-screen helper that replaces the current wide/profile split in `viewer-shell.tsx`.
  - Deterministic fallback when source dimensions are absent must be encoded inside the context creation step, not scattered at call sites.
- `ViewerSettings.deepStarsEnabled`
  - Backward-compatible persisted preference for main-view deep-star behavior.
  - Old payloads remain readable; absence means auto/default resolution, explicit values override the governor.
- `AdaptiveDeepStarTier`
  - Explicit named runtime tier with a small constant table of knobs controlling deep-star workload and optional color degradation.
  - Diagnostics must report the tier and reason for the current state.
- `DeepStarEnablementResolution`
  - Runtime-only viewer-shell result containing `enabled`, `source`, `tier`, and `reason`.
  - Drives fetch/selection/projection/render gating so disabled mode removes workload at the pipeline boundary.

## Compatibility and invariants
- Scope mode keeps its existing square-lens projection, scope clipping semantics, and persisted `scopeOptics` behavior.
- No storage-key rotation is planned; new settings must read missing fields as backward-compatible defaults.
- Main-view startup defaults must remain conservative and should not present a deep-star-dense sky on first render.
- Main-view deep stars may influence center-lock and selected-detail behavior when enabled, but they must not repopulate ordinary main-view labels or markers outside the center-locked/selected exceptions.
- Quality-tier degradation may reduce deep-star workload and color richness, but it must not introduce a second non-scope projection basis.

## Regression controls
- Keep non-scope projection consolidation local to the existing camera/viewer helpers; do not introduce a second projection subsystem.
- Reuse the current scope deep-star pipeline and tile-selection primitives where possible; change gating and non-scope projection inputs rather than inventing a separate catalog path.
- Prefer memoization or init-time validation for constellations over runtime schema parsing inside render loops.
- Add deterministic fixtures for governor thresholds and startup density so low-end protection and conservative defaults stay testable without timing-sensitive assertions.
- Use the existing targeted suites as the primary guardrails and expand them only where the new contract requires explicit coverage.

## Risk register
- Risk: a new projection context is added, but some non-scope overlays keep calling the old helpers directly and drift out of alignment.
  - Mitigation: treat all non-scope world-to-screen calls in `viewer-shell.tsx` as one audit list and add subpixel alignment assertions for markers, constellation segments, and focused trails.
- Risk: deep-stars-disabled mode still performs fetch or projection work and only hides output.
  - Mitigation: gate request setup and projection list construction before tile selection/projection work and add workload-reduction tests that assert no deep-star tile activity when disabled.
- Risk: adaptive governance changes visible startup density or scope behavior unintentionally.
  - Mitigation: keep governance limited to main-view deep-star participation, preserve scope-only rules, and add deterministic startup-band plus scope-regression tests.
- Risk: B-V color parity extraction introduces a new shared utility but leaves scope and main view with inconsistent fallbacks.
  - Mitigation: move only the color mapping into a small shared helper, keep rendering-shape differences local, and add parity-focused tests for representative B-V bands.
- Risk: one-time constellation validation breaks tests that pass alternate catalogs by array identity.
  - Mitigation: validate bundled data eagerly and memoize any non-bundled validation by catalog identity so tests remain explicit without reintroducing per-frame work.

## Rollback
- Revert the non-scope projection-context wiring as one coherent change if alignment regressions appear; keep scope projection untouched so rollback stays local.
- Revert adaptive deep-star governance independently from projection consolidation if low-end heuristics or precedence prove unstable.
- Preserve settings compatibility so rollback never requires storage migration or cleanup.
