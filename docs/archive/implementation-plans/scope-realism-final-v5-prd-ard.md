# SkyLensServerless Scope Realism Final v5 — Complete Standalone PRD + ARD (Autoloop-Ready)

## 0) Document contract
This is a single complete specification for implementing the next scope realism iteration in **SkyLensServerless**.

It supersedes prior draft task docs and is designed so an autonomous coding agent can implement directly from this file.

---

## 1) Product intent
Deliver a scope experience that is visually credible and user-pleasing:
1. `magnificationX` remains canonical for scope zoom behavior.
2. Deep stars look crisp and dim (no bloated halo artifacts).
3. Aperture and magnification influence perceived realism across stars + extended bodies.
4. User can tune telescope lens diameter on screen as % of height (default 75%).

---

## 2) Scope
## In scope
- Deep-star canvas rendering and runtime deep-star display attenuation.
- Scope visual behavior for Sun/Moon/planets/stars under magnification/aperture.
- New persisted setting: scope lens diameter percentage.
- Required tests and migration safety.

## Out of scope
- Catalog source architecture (remote/local loading order unchanged).
- Data pipeline/rebuild changes.
- Any binary `.bin` artifacts.

---

## 3) Locked decisions
1. `scopeOptics.magnificationX` stays canonical for scope zoom semantics.
2. Deep-star rendering is **core-only** (no halo pass).
3. Existing deep-star inclusion order remains unchanged:
   - existing likely-visible/daylight gates,
   - horizon gate,
   - limiting-magnitude gate,
   - profile compute.
4. Extended objects (Sun/Moon/planets) must show stronger magnification realism than current fixed marker constants.
5. Add `scopeLensDiameterPct` setting, default `75` (% of viewport height), persisted.
6. No `.bin` files added.

---

## 4) PRD

## 4.1 Goals
- Restore crisp deep-star appearance.
- Make small-aperture deep-star scenes noticeably dimmer.
- Improve scope realism for extended objects under magnification.
- Add user control for on-screen telescope diameter.

## 4.2 Functional requirements

### FR-1 Deep stars are core-only points
- Deep stars must render with one core draw pass.
- No halo/gradient bloom for deep stars.

### FR-2 Deep-star small-aperture dimness
- Deep-star display intensity includes additional aperture-based attenuation (display-only), applied after existing photometry profile is computed.
- Must be monotonic: larger aperture => less attenuation.

### FR-3 Extended-object magnification realism
For scope mode, Sun/Moon/planets should be sized by angular behavior under scope FOV (not mostly fixed constants).
- Apparent disk size should increase as magnification increases (effective FOV narrows).
- Keep practical clamp bounds for usability.

### FR-4 Extended-object brightness realism
In scope mode, extended-object brightness (Sun/Moon/planets) should respond to aperture + magnification using a deterministic display model.
- At fixed aperture, higher magnification should not make them unnaturally brighter.
- At fixed magnification, larger aperture should support brighter display.

### FR-5 Scope lens diameter user setting
Add user setting:
- `scopeLensDiameterPct` (percentage of viewport height)
- default: `75`
- recommended range: `50..90`
- persisted and clamped

Lens diameter px computation in scope mode must derive from this setting and viewport height, with safety min/max clamps.

### FR-6 Backward compatibility
- Existing persisted payloads load safely.
- Missing `scopeLensDiameterPct` defaults to 75.
- Existing optics and scope mode fields remain backward compatible.

---

## 5) ARD

## 5.1 Files expected to change
1. `SkyLensServerless/components/viewer/scope-star-canvas.tsx`
2. `SkyLensServerless/components/viewer/viewer-shell.tsx`
3. `SkyLensServerless/lib/viewer/settings.ts`
4. `SkyLensServerless/components/settings/settings-sheet.tsx`
5. Tests under `SkyLensServerless/tests/unit/`:
   - `scope-star-canvas.test.tsx`
   - `viewer-shell-scope-runtime.test.tsx`
   - `viewer-settings.test.tsx`
   - `settings-sheet.test.tsx`
   - optionally `viewer-shell.test.ts`

## 5.2 Deep-star rendering architecture

### 5.2.1 Canvas contract
Deep-star points may still carry legacy `haloPx` in payload for compatibility, but renderer ignores it.

Renderer uses:
- `corePx`
- `intensity`
- `bMinusV`

### 5.2.2 Core-only draw
For each deep star:
1. `coreRadiusPx = clamp(corePxAdjusted, CORE_MIN_PX, CORE_MAX_PX)`
2. `coreAlpha = clamp(intensityAdjustedMapped, CORE_ALPHA_MIN, CORE_ALPHA_MAX)`
3. one circle draw with color from `bMinusV`

No second pass.

## 5.3 Deep-star attenuation model (display-only)
Apply in `viewer-shell` when mapping deep-star canvas points.

Recommended baseline:
- `apertureFactor = clamp((apertureMm - 40) / (240 - 40), 0, 1)`
- `deepStarAttenuation = 0.45 + 0.55 * apertureFactor`
- `intensityAdjusted = baseIntensity * deepStarAttenuation`

Constants are tunable but must preserve monotonicity and visual intent.

## 5.4 Extended-object size model (scope mode)
Replace scope-mode fixed marker sizing for Sun/Moon/planets with angular-size-aware sizing under effective scope FOV.

Implementation options (choose deterministic one):
- Compute pixel diameter from known angular diameters and scope projection scale.
- For planets without direct angular data, use stable per-planet baseline diameters with magnification/FOV scaling.

Mandatory behavior:
- magnification up => apparent disk size up (within clamps)

## 5.5 Extended-object brightness model (scope mode)
Add deterministic opacity/intensity adjustment for Sun/Moon/planets based on aperture and magnification.

Do not reuse deep-star core-only rendering path for extended objects.

## 5.6 Scope lens diameter setting model
Add to viewer settings model:
- `scopeLensDiameterPct: number`

Lens px calc in viewer shell:
- `lensPx = clamp(viewport.height * (scopeLensDiameterPct / 100), MIN_PX, MAX_PX)`

Keep MIN/MAX consistent with UX safety and touch ergonomics.

---

## 6) Settings and UI requirements

### 6.1 Settings schema changes
In `lib/viewer/settings.ts`:
- add field to `ViewerSettings`.
- read/normalize/clamp/persist.
- include in defaults and migration logic.

### 6.2 Settings sheet UI
In `components/settings/settings-sheet.tsx`:
- add a slider/control for “Telescope diameter” (or equivalent copy).
- value is `% of screen height`.
- default shown as 75%.

### 6.3 Scope UI behavior
Changing lens diameter setting should immediately update scope lens diameter and related projection selection radius behavior.

---

## 7) Acceptance criteria

### AC-1 Deep-star visuals
Deep stars are crisp compact points; no halo/bloom visible.

### AC-2 Deep-star dimness realism
At small aperture settings, deep stars are visibly dimmer than at large aperture under same viewing conditions.

### AC-3 Extended-object magnification realism
Sun/Moon/planets visibly increase apparent size as magnification increases.

### AC-4 Extended-object brightness behavior
Brightness behavior is deterministic and realistically constrained with aperture/magnification changes.

### AC-5 Lens diameter setting
User can set scope diameter as % of height; default 75%; persisted and respected at runtime.

### AC-6 Compatibility
No regressions in gating order, settings migration, and scope mode stability.

### AC-7 No binary artifacts
No `.bin` files added.

---

## 8) Required tests

## 8.1 Unit tests
- `scope-star-canvas.test.tsx`
  - one pass per deep star
  - no halo/gradient path
  - compact radius/alpha bounds
  - color mapping unchanged

- `viewer-settings.test.tsx`
  - new `scopeLensDiameterPct` defaults, clamp, persistence, migration

- `settings-sheet.test.tsx`
  - renders and updates telescope diameter control

## 8.2 Runtime tests
- `viewer-shell-scope-runtime.test.tsx`
  - deep-star dimness lower at small aperture than large aperture
  - existing deep-star inclusion gates unchanged
  - magnification-driven spacing unchanged
  - lens diameter setting changes actual scope lens px behavior

- `viewer-shell.test.ts` (if needed)
  - integration sanity for new setting and scope controls

## 8.3 Minimum commands
Run at minimum:
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx`

Recommended broader scoped run:
- `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-lens-overlay.test.tsx`

---

## 9) Implementation sequence for autoloop
1. Implement deep-star core-only renderer.
2. Add deep-star aperture attenuation in viewer-shell mapping.
3. Implement extended-object scope size + brightness adjustments.
4. Add `scopeLensDiameterPct` model and UI control.
5. Update tests.
6. Run required tests and fix failures.
7. Verify no `.bin` artifacts in git status.

---

## 10) Non-negotiable guardrails
- No autoloop edits outside scoped files unless required by compile/tests.
- No deployment changes.
- No `.gitignore` changes for binary handling.
- No `.bin` additions.
- Keep deterministic behavior and avoid flaky visual assertions.
