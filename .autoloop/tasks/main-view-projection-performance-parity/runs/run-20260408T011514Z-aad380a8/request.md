# Autoloop Task: Main-View Projection, Performance Governance, and Visual Parity

Implement the following standalone plan in this repository using conservative, auditable diffs and preserving scope-mode behavior.

## Objective
Fix unresolved review feedback for:
- main-view projection consistency,
- low-end performance protection,
- non-scope visual parity.

## Mandatory execution contract
- Use autoloop with pairs: `plan,implement,test`.
- Use full-auto answers mode.
- Do not set `max_iterations`.
- Do not stop for idle-looking output; wait for terminal completion.
- Prefer canonical paths under `SkyLensServerless/...`.
- If legacy paths conflict, prefer files imported by `SkyLensServerless/components/viewer/viewer-shell.tsx` and document decisions.

## Required files in scope
- `SkyLensServerless/components/viewer/viewer-shell.tsx`
- `SkyLensServerless/lib/projection/camera.ts`
- `SkyLensServerless/lib/astronomy/constellations.ts`
- `SkyLensServerless/lib/astronomy/stars.ts`
- `SkyLensServerless/lib/viewer/scope-optics.ts`
- `SkyLensServerless/lib/viewer/settings.ts`
- `SkyLensServerless/components/settings/settings-sheet.tsx`
- `SkyLensServerless/components/viewer/scope-star-canvas.tsx` (or equivalent star-color path)

## Required tests in scope
- `SkyLensServerless/tests/unit/viewer-shell.test.ts`
- `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
- `SkyLensServerless/tests/unit/projection-camera.test.ts`
- `SkyLensServerless/tests/unit/scope-optics.test.ts`
- `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
- `SkyLensServerless/tests/unit/celestial-layer.test.ts`
- `SkyLensServerless/tests/e2e/demo.spec.ts` (best effort)

## Implementation requirements

### 1) Projection correctness and consolidation
- Build one non-scope projection context per render pass with: effective vertical FOV, profile, viewport dims, source dims when available.
- Route bright objects, deep stars, constellation endpoints, and focused trail points through one non-scope world→screen helper.
- Ensure camera source dimensions are propagated for profile projection where available.
- Ensure explicit deterministic fallback when source dimensions are absent.
- Preserve scope-only projection and clipping semantics.

### 2) Inline comment remediation checkpoints
- IC-1: Camera-frame-aware projection for main objects.
- IC-2: Camera-frame-aware projection for deep stars.
- IC-3: Overlay projection consistency (constellations + focused trails).
- IC-4: Regression guardrails to catch IC-1..IC-3 regressions.

### 3) Performance and behavior controls
- Add explicit main-view deep-stars toggle (`deepStarsEnabled`) that gates deep-star fetch/selection/projection/render.
- Implement adaptive quality governor with explicit tiers and tunable knobs.
- Add numeric downgrade/upgrade thresholds and hysteresis windows.
- Define precedence: user explicit toggle > adaptive governor > device default heuristic.
- Expose dev-only diagnostics: tier, deep-stars enabled source (user/auto/default), transition reason.

### 4) Visual parity
- Share B-V star color mapping logic with non-scope stars when deep-stars are enabled.
- Permit quality-tier-aware graceful degradation of color behavior without changing projection correctness.

### 5) Hot-path safety
- Ensure constellation catalog validation is not in per-frame production hot path.
- Validate once at init or memoize by catalog identity.

### 6) Conservative startup behavior
- Keep main-view default optics conservative so startup visible-star density resembles bright-catalog baseline, not deep-star-dense sky.
- Deep stars can participate in center-lock, but deep-star labels/markers in main view should be center-only (+ selected object).
- Magnification should follow existing scope realism projection/FOV semantics and not amplify emergence beyond intended behavior.

## Validation commands
Run and report results (with substitutions if needed):
1. `rg --files SkyLensServerless/tests | head -n 200`
2. `cd SkyLensServerless && pnpm install --frozen-lockfile`
3. `cd SkyLensServerless && pnpm exec vitest run tests/unit/projection-camera.test.ts tests/unit/celestial-layer.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/viewer-shell.test.ts tests/unit/scope-optics.test.ts`
4. `cd SkyLensServerless && pnpm exec vitest run tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx`
5. `cd SkyLensServerless && pnpm exec playwright test tests/e2e/demo.spec.ts` (best effort)
6. `cd SkyLensServerless && pnpm exec vitest run tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts`

## Acceptance criteria (all required)
1. Single camera-frame-aware projection basis across non-scope markers/deep-stars/constellations/trails.
2. Source-dimension propagation explicit and test-covered.
3. Scope-mode behavior unchanged.
4. Conservative startup aperture baseline preserved and tested.
5. Regression tests demonstrate effective guardrails.
6. No new duplicated projection branches.
7. Main-view startup defaults remain conservative.
8. Deep-star labels/markers in main view are zero unless center-locked/selected.
9. Constellation validation removed from per-frame production runtime.
10. Deep-stars-disabled mode eliminates deep-star workload while preserving center-lock correctness for non-deep objects.
11. Adaptive governor honors hysteresis and precedence.
12. Non-scope B-V color parity path works and remains stable across tiers.

### Quantitative addendum
- Enforce deterministic fixture-based conservative startup visible-star count band.
- Enforce zero deep-star markers/labels in main view unless center-locked/selected.
- Enforce subpixel projection alignment tolerance between markers and overlays.
- Verify numeric governor thresholds with deterministic transition tests.
- Verify deep-stars-disabled workload reduction.

## Required PR notes content
- Before/after projection path summary.
- IC-1..IC-4 closure mapping to code/tests.
- Test evidence and environment limitations.
- Risk note confirming scope behavior and aperture baseline preserved.
- Artifact hygiene note: `.autoloop/` artifacts excluded from implementation diffs.
- Performance governor evidence: thresholds, transitions, precedence proof.
