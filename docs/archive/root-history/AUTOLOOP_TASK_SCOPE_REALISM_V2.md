# SkyLensServerless Scope Realism v2 — Final Standalone PRD + ARD

## Document metadata
- Product: SkyLensServerless
- Scope: Runtime scope-mode optics, deep-star rendering, and control-state semantics
- Status: Implementation-ready
- Audience: Autonomous coding agent (autoloop) operating in this repository
- Normative language: **MUST**, **MUST NOT**, **SHOULD**, **MAY** are binding
- Canonical target path: `/workspace/SkyLens/SkyLensServerless`

---

## 1) Problem statement
Users expect telescope-like behavior in scope mode:
1. Increasing **magnification** should increase apparent separation between stars (narrower field of view).
2. Increasing **aperture** should reveal fainter stars.
3. Decreasing transparency / altitude should reduce visibility and intensity.
4. Bright-star and deep-star pipelines should behave consistently under the same optics.

Current state partially implements scope optics, but deep-star rendering remains disconnected from optics in key paths. This PRD/ARD defines the exact implementation to complete realism behavior while preserving performance and backward compatibility.

---

## 2) Locked decisions
1. `magnificationX` is the **source of truth** for scope magnification semantics.
2. Scope projection FOV MUST be derived from `magnificationX` via deterministic conversion.
3. `apertureMm`, `magnificationX`, and `transparencyPct` MUST influence deep-star visibility and photometry.
4. Existing likely-visible/daylight suppression logic remains unchanged.
5. Stars remain compact; no linear 1:1 diameter scaling with magnification.
6. Backward compatibility for persisted settings MUST be preserved.
7. Runtime behavior must stay deterministic under fixed inputs.

---

## 3) Goals
### Primary goals
- Apply optics-driven limiting magnitude to **both** bright stars and deep stars.
- Make magnification visibly affect star spacing by driving scope projection FOV.
- Apply optics photometry to deep-star rendering so brightness/halo responds to conditions.
- Keep UI controls and persistence coherent and backward compatible.

### Non-goals
- No Bortle/skyglow/moonlight phase simulation in this revision.
- No complete physical eyepiece catalog model.
- No server-side runtime changes.

---

## 4) Functional requirements

### FR-1 Canonical scope optics state
Viewer settings MUST retain:
- `scopeModeEnabled: boolean`
- `scopeOptics: { apertureMm, magnificationX, transparencyPct }`

And MUST treat `scopeOptics.magnificationX` as canonical for scope zoom semantics.

### FR-2 Projection FOV derived from magnification
Runtime scope projection profile MUST use:
- `scopeVerticalFovDeg = magnificationToScopeVerticalFovDeg(magnificationX, apparentFieldDeg)`
- Deterministic defaults and clamping.

The lens projection and selection radius calculations MUST use this effective scope FOV.

### FR-3 Optics limiting magnitude applied to deep stars
For each deep star candidate (tile row), after existing gates:
1. Convert to horizontal coordinates.
2. If below horizon, reject.
3. If scope mode enabled, apply limiting magnitude check using `(vMag, altitudeDeg, scopeOptics)`.
4. Render only passing stars.

### FR-4 Optics photometry applied to deep-star render output
For each deep star that passes, compute scope photometry profile and feed renderer metadata:
- intensity
- corePx
- haloPx

Deep-star canvas MUST consume this metadata directly instead of static magnitude buckets.

### FR-5 Existing likely-visible/daylight behavior unchanged
- Existing likely-visible/daylight suppression order and thresholds MUST remain unchanged.
- Scope optics apply only after existing gates.

### FR-6 UI placement and behavior
- Quick controls: aperture + magnification when scope mode ON.
- Settings: transparency + marker-scale.
- Toggle sync between quick controls and settings MUST remain correct.

### FR-7 Backward compatibility
Persisted payloads lacking new/derived fields must safely normalize.
Legacy fields (e.g., stored `scope.verticalFovDeg`) MUST be migrated/read safely without breaking previous installs.

---

## 5) Acceptance criteria
1. Increasing `magnificationX` monotonically narrows effective scope FOV and increases apparent star separation.
2. Increasing aperture / transparency / altitude monotonically improves limiting magnitude and star retention near threshold.
3. Deep-star brightness and halo react monotonically to optics and conditions.
4. No regression in likely-visible/daylight suppression behavior.
5. 10x magnification MUST NOT imply 10x star core diameter.
6. Legacy settings payloads continue to load with sensible defaults/migration.
7. Unit/integration tests covering these behaviors pass.

---

## 6) ARD: implementation design

### 6.1 Modules and responsibilities

#### A) `lib/viewer/scope-optics.ts`
Keep and extend existing pure helpers:
- `computeScopeLimitingMagnitude(...)`
- `passesScopeLimitingMagnitude(...)`
- `computeScopeRenderProfile(...)`

Add:
- `magnificationToScopeVerticalFovDeg(magnificationX: number, apparentFieldDeg?: number): number`
- optional inverse helper if useful for migration/UI display.

Constraints:
- Deterministic pure functions.
- Shared clamp/range handling with existing optics normalization.

#### B) `components/viewer/viewer-shell.tsx`
- Build scope projection profile from effective FOV derived from magnification.
- Ensure tile selection radius and scope band selection use the same effective FOV.
- In deep-star mapping path:
  - apply limiting magnitude gate per deep star.
  - compute render profile for passing stars.
  - pass render profile fields to canvas point payload.

#### C) `components/viewer/scope-star-canvas.tsx`
- Replace fixed radius/opacity bucket functions with profile-driven drawing.
- Keep stars compact via clamped ranges; avoid linear magnification blowup.
- Preserve color mapping from `bMinusV` unless explicitly improved.

#### D) `lib/scope/depth.ts` (optional but preferred)
If feasible within this change budget:
- ensure band/depth selection uses the same effective scope FOV derived from magnification.
- maintain current orientation/alignment guardrails.

#### E) `lib/viewer/settings.ts`
- Preserve canonical `scopeOptics` persistence.
- Add any needed migration logic for legacy scope FOV payloads.
- Keep current defaults and clamp behavior.

---

## 7) Data/contract updates

### 7.1 ScopeStarCanvas point contract
Update `ScopeStarCanvasPoint` to include render profile data for deep stars, e.g.:
- `intensity: number`
- `corePx: number`
- `haloPx: number`

(Exact names may align with existing profile type aliases.)

### 7.2 Metadata contract consistency
Deep-star and bright-star scope metadata should remain compatible in semantics (`scopeRender` fields), even if transport shape differs for canvas points.

---

## 8) Algorithmic requirements

### 8.1 Limiting magnitude
Use existing locked formula (current code baseline):
- `base = 2.2 + 2.0*log10(A) + 0.30*log10(M)`
- transparency and altitude adjustments
- clamp to [3.0, 15.5]

### 8.2 Photometry
Use existing profile computation and compact star sizing intent:
- intensity from relative flux + transmission + optics gain
- clamped core/halo values

### 8.3 Magnification→FOV
Define deterministic conversion with documented default apparent field (e.g., 50° unless existing product constant differs).
Clamp resulting vertical FOV to current safe UI/runtime bounds.

---

## 9) Testing plan (mandatory)

### Unit tests
1. `tests/unit/scope-optics.test.ts`
   - add monotonic tests for magnification→FOV conversion.
   - keep malformed-input finite-output guarantees.

2. scope/depth tests
   - verify depth/FOV behavior remains deterministic and consistent with magnification-derived FOV.

### Integration/runtime tests
3. `tests/unit/viewer-shell-scope-runtime.test.tsx`
   - deep stars are filtered by optics limit.
   - deep-star rendered intensity/size reacts to optics changes.
   - magnification changes spacing/projection behavior.

4. regression tests
   - likely-visible/daylight behavior unchanged.
   - quick controls + settings sync unchanged.
   - legacy settings round-trip unchanged.

### Verification commands
Run all relevant tests for changed modules and project-level test target(s) used in this repo.

---

## 10) Implementation sequencing for autoloop
Autoloop MUST run with:
- `--full-auto-answers`
- `--pairs plan,implement,test`
- **no** `--max-iterations` argument

Execution order:
1. Plan phase: map touched files and test impact.
2. Implement phase: apply minimal cohesive refactor across optics + viewer + canvas + settings.
3. Test phase: run targeted and then broader tests.

---

## 11) Definition of done
- Magnification is canonical source for scope zoom semantics.
- Deep-star pipeline applies optics limiting magnitude + photometric rendering.
- Projection spacing responds to magnification.
- UI placement and persistence requirements remain satisfied.
- Likely-visible/daylight behavior unchanged.
- Tests pass with new coverage for deep-star optics behavior.

---

## 12) Constraints and safeguards
- Do not remove existing deterministic guards and clamps.
- Do not introduce non-deterministic rendering state into pure optics calculations.
- Avoid broad unrelated refactors.
- Keep runtime performant for mobile viewport usage.

