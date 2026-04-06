# SkyLensServerless Scope Deep-Star Render Quality v3 — Standalone PRD + ARD

## 0) Document intent
This is a complete implementation contract for an autonomous coding agent to improve deep-star visual quality in **SkyLensServerless** after the magnification-canonical optics rollout.

The goal is to keep the physically-informed optics pipeline while restoring compact, crisp deep-star rendering at mobile lens sizes.

---

## 1) Product context and problem
Current deep-star rendering is functionally correct (optics-aware filtering + photometry), but stars appear too large/bloated compared to the pre-optics look.

### Root cause summary
- Pre-change renderer drew one disk with small fixed radii (~1.05–2.4 px).
- Current renderer draws two passes (halo + core) with larger profile radii (halo up to ~5.9 px), which dominates perceived size in a ~220–320 px scope lens.
- Flat filled halo circles produce harder “blob” halos; small canvases need better falloff.

---

## 2) Scope
This work applies to **SkyLensServerless only**.

### In scope
- Deep-star canvas visual tuning (radius compression, opacity compression, radial gradient halo).
- Mobile-lens-aware scaling (diameter-aware render compression).
- Preserve existing optics gating and metadata generation semantics.
- Add robust unit/runtime tests for visual contract behavior.

### Out of scope
- Changing source catalog hosting/fetch order (R2/local behavior unchanged).
- Reverting magnification canonical source-of-truth behavior.
- Changing bright-star non-canvas marker logic except where needed for parity tests.

---

## 3) Locked decisions
1. `scopeOptics.magnificationX` remains canonical for zoom semantics.
2. Deep-star visibility gating order remains:
   - existing likely-visible/daylight gates,
   - horizon check,
   - optics limiting magnitude,
   - photometry render profile.
3. Deep-star canvas keeps two-pass rendering (halo + core), but halo MUST be radial gradient (not a flat filled circle).
4. Stars must remain compact on small lens diameters.
5. No `.bin` assets are added in this change.

---

## 4) PRD

## 4.1 Goals
- Restore a visually crisp deep-star look close to historical compactness.
- Keep optics realism (brighter optics still increase visibility/intensity).
- Reduce “bloated halo” artifacts on small mobile lenses.

## 4.2 Functional requirements

### FR-1: Compact radius envelope
For deep-star canvas drawing:
- Core radius must remain compact.
- Halo radius must be compressed and diameter-aware.
- Absolute halo cap must be lower than current implementation.

### FR-2: Radial gradient halo
Halo must be drawn as a radial gradient with smooth falloff from center to edge.
- Center alpha uses tuned halo opacity.
- Edge alpha approaches 0.
- Core draw remains a separate filled pass.
- Halo MUST render only when the effective core radius is at/above a minimum threshold
  (to avoid bloated/fuzzy rendering on tiny stars).

### FR-3: Lens-diameter-aware compression
Renderer must apply a deterministic compression factor based on `diameterPx`:
- smaller lens -> stronger compression
- larger lens -> weaker compression
- bounded/clamped range

### FR-4: Preserve optics semantics
Do not change deep-star filtering eligibility semantics:
- `passesScopeLimitingMagnitude(...)` and `computeScopeRenderProfile(...)` usage remains in runtime.

### FR-5: Preserve color semantics
`bMinusV` color mapping remains unchanged unless explicitly required by tests.

---

## 5) ARD

## 5.1 Files to modify
1. `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
2. `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`
3. `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx` (only if needed for contract assertions)

No other files are required unless tests demand helper extraction.

## 5.2 Rendering design

### 5.2.1 Compression helpers
Introduce pure local helpers in `scope-star-canvas.tsx`:
- `getLensCompressionFactor(diameterPx)`
  - Returns clamped factor in [0.72, 1.0] (recommended; exact values may be tuned)
- `compressRadius(radiusPx, compressionFactor, min, max)`

### 5.2.2 Radius targets (recommended constraints)
- Core effective radius range target: ~[0.9, 2.2]
- Halo effective radius range target: ~[1.4, 3.6]

Use existing profile fields (`corePx`, `haloPx`) as inputs, then compress and clamp into the above envelopes.

### 5.2.3 Opacity tuning (recommended constraints)
- Halo alpha range: ~[0.06, 0.30]
- Core alpha range: ~[0.35, 0.95]

Maintain monotonic intensity response.

### 5.2.4 Gradient halo implementation
For each star:
1. Compute compressed halo radius.
2. Compute compressed core radius.
3. If `coreRadiusPx >= haloEnableCoreRadiusThresholdPx`:
   - Create radial gradient:
     - center stop alpha = tuned halo alpha
     - outer stop alpha = 0
   - Draw halo circle with gradient fill.
4. Draw core pass as solid color with core alpha (always).

If gradient creation fails for any reason, fallback to solid halo fill with tuned halo alpha (deterministic fallback).

Recommended initial threshold:
- `haloEnableCoreRadiusThresholdPx = 1.15` (tunable, deterministic constant)

## 5.3 Performance constraints
- Avoid unnecessary context state thrash in the star loop.
- Keep O(n) behavior over stars.
- Do not allocate excessive temporary objects inside hot loop where avoidable.

---

## 6) Detailed acceptance criteria

### AC-1 Visual compactness
At default scope settings and typical lens diameter (~240–280 px), deep stars no longer appear larger than intended; halo footprint is materially smaller than the current post-optics baseline.

### AC-2 Optics monotonicity preserved
Improved optics conditions still increase apparent brightness and slight size response without returning to bloat.

### AC-3 Gradient correctness
Halo uses radial gradient with transparent edge; tests validate gradient API usage and stop configuration.

### AC-4 Backward safety
No regressions in deep-star gating order or scope mode behavior.

### AC-5 No binary artifacts
No `.bin` files are introduced/committed in this change.

---

## 7) Test plan (required)

### 7.1 Unit tests: scope-star-canvas
Update/add assertions for:
1. Gradient halo creation is called for each star.
2. Gradient includes center and edge stops with expected monotonic alpha falloff.
3. Compressed/clamped core and halo radii remain inside compact envelopes.
4. Halo is NOT rendered when core radius is below threshold.
5. Fallback path still renders if gradient cannot be created.
6. Existing color semantics remain unchanged.

### 7.2 Runtime tests: viewer-shell-scope-runtime
Ensure deep-star runtime still:
- filters by optics limit,
- preserves below-horizon rejection,
- preserves magnification-driven spacing behavior.

### 7.3 Command validation
At minimum run:
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx`

If stable, also run broader scoped pack:
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-lens-overlay.test.tsx`

---

## 8) Implementation guardrails
- Do not touch deployment scripts in this task.
- Do not alter catalog source resolution (`lib/scope/catalog.ts`, `lib/config.ts`) in this task.
- Do not add `.bin` files or `.gitignore` rules.
- Keep deterministic behavior in tests; use mocked canvas context (no pixel snapshots).

---

## 9) Delivery checklist
1. Code updated in `scope-star-canvas.tsx` with gradient + compact compression.
2. Tests updated and passing for modified behavior.
3. No binary files added.
4. Summary clearly states tuned envelopes and final test commands/results.
