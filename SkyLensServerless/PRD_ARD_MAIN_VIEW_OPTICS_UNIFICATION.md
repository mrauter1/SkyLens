# SkyLensServerless PRD + ARD
## Main-Viewer Optics Unification (Scope Functionality Without Lens Circle)

- **Status:** Updated proposal
- **Owner:** SkyLens product + platform
- **Date:** 2026-04-07
- **Target release:** Next minor release after implementation completion
- **Decision state:** Product behavior decisions finalized in ticket follow-ups

---

## 1) Product Requirements Document (PRD)

### 1.1 Problem statement
SkyLens currently concentrates optics behavior (aperture/magnification realism, deep-star emergence, and scope projection) inside scope mode presentation. This creates a split experience between:
- main viewer behavior, and
- scope lens behavior.

We need a single optics behavior pipeline that runs in the main viewer by default, while keeping scope lens overlay as optional presentation.

### 1.2 Goals
1. Keep scope mode available and optional.
2. Run optics behavior in the main viewer by default (always active).
3. Show same baseline visual behavior on load as today, with **main-view magnification default = 1.0x**.
4. Allow magnification in main view down to **0.25x** and up beyond 1.0x.
5. Make magnification affect **field of view only**.
6. Make deep-star emergence controlled by **aperture only**.
7. Include deep stars in center-lock and labels using unified rules.
8. Keep UI controls visually the same across modes, but wire state independently by mode.
9. Enforce DRY implementation (single shared behavior logic).

### 1.3 Non-goals
1. Removing scope mode or lens overlay.
2. Introducing additional star catalogs in this change.
3. Redesigning control labels/copy (same control naming retained).
4. Reworking unrelated permission/camera/location systems.

### 1.4 Functional requirements

#### FR-1: Always-active main-view optics
- Main viewer optics behavior is active by default.
- Lens overlay toggle does not disable main optics behavior.

#### FR-2: Magnification semantics
- Main-view magnification default is **1.0x**.
- Allowed range includes **0.25x minimum**.
- Magnification changes FOV/projection only.
- Magnification does not directly alter deep-star emergence thresholds.

#### FR-3: Aperture semantics
- Aperture controls deep-star emergence visibility behavior.
- Aperture is independent from magnification effects except combined visual result.

#### FR-4: Catalog scope
- Deep-star rendering in this feature uses HYG data only.

#### FR-5: Center-lock and label eligibility
- Center-lock and labels are available for all visible objects, including deep stars.
- Primary winner rule: closest to center.
- Tie-breaker rule for perfect overlap: brightest wins.
- Final deterministic fallback for exact ties (stable object-id ordering) to prevent flicker.

#### FR-6: Persistence behavior split
- **Main view:** aperture and magnification are not persisted; always load main defaults.
- **Scope mode:** aperture and magnification are persisted and independent from main view values.
- Controls remain visually identical across modes, but bind to mode-specific state.

#### FR-7: Scope overlay as presentation only
- Scope mode remains optional and controls only lens presentation and associated framing.
- Scope mode does not own shared optics formulas.

#### FR-8: DRY architecture requirement
- No duplicated optics math, deep-star filtering, projection conversion, or center-lock ranking paths.

### 1.5 UX requirements
1. Main viewer always exposes optics sliders on load.
2. Scope mode uses the same control style and labels, with independent scope-bound values.
3. User can toggle scope mode without losing main-view defaults.
4. Transition between main and scope mode should be immediate and visually stable.

### 1.6 Defaults and ranges

#### Main-view defaults
- Magnification: **1.0x**
- Magnification min: **0.25x**
- Aperture: **main default value tuned to preserve existing baseline appearance at 1.0x**

#### Scope-mode defaults
- Use current scope defaults and persisted scope values as independent mode state.

### 1.7 Acceptance criteria
1. App load (non-scope): optics active, sliders visible, magnification at 1.0x.
2. Lowering magnification below 1.0x widens FOV only; emergence threshold unchanged unless aperture changes.
3. Increasing/decreasing aperture changes deep-star emergence behavior without changing FOV mapping.
4. Center-lock picks nearest object across all visible object classes.
5. Perfect overlap tie-break picks brightest; unresolved tie uses deterministic id fallback.
6. Main-view optics values reset to defaults on reload.
7. Scope-mode optics values persist across reload and remain independent from main-view values.
8. Scope overlay toggle changes only presentation framing behavior, not shared optics pipeline activation.

### 1.8 Success metrics
1. No regression in center-lock stability (no lock flicker from non-deterministic ties).
2. No regression in baseline startup appearance relative to current production behavior.
3. User-observable parity: scope and main modes use same control affordances with expected independent values.

---

## 2) Architecture Requirements Document (ARD)

### 2.1 Existing architectural boundaries (implementation targets)
- `components/viewer/viewer-shell.tsx`
  - Runtime composition, scene projection, center-lock selection, mode presentation, and control wiring.
- `lib/viewer/scope-optics.ts`
  - Optics normalization, limiting magnitude, render profile, and magnification/FOV mapping formulas.
- `lib/astronomy/stars.ts`
  - Bright-star normalization and per-object metadata construction.
- `lib/scope/*`
  - Deep-star band selection, tile selection/loading, coordinate conversions.
- `components/settings/settings-sheet.tsx`
  - Settings UI control surfaces and callbacks.

### 2.2 Target runtime model
Separate behavior state from presentation state:

1. **Main optics behavior state** (always active in main view; non-persisted values with defaults).
2. **Scope optics behavior state** (used when scope mode active; persisted values).
3. **Scope lens presentation state** (controls circular lens rendering only).

### 2.3 Canonical state model

```ts
// conceptual model
mainOptics: {
  apertureMm: number    // default on each load, not persisted
  magnificationX: number // default 1.0x on each load, min 0.25x
}
scopeOptics: {
  apertureMm: number    // persisted
  magnificationX: number // persisted
}
mode: {
  scopeLensOverlayEnabled: boolean
}
```

### 2.4 Key architecture decisions

#### AD-1: No shared mutable optics bucket across modes
Main and scope optics values are independent state sources. UI widgets are shared visually, but callback wiring targets mode-specific state.

#### AD-2: Single shared optics computation pipeline
A shared function set computes:
- limiting magnitude,
- projection profile from magnification,
- deep-star render profile,
- center-lock candidate scoring.

Inputs change by mode-selected optics state, but formulas are not duplicated.

#### AD-3: Magnification-to-FOV only
Magnification is used only for projection/FOV effects. Deep-star inclusion thresholds are aperture-driven.

#### AD-4: Unified center-lock ranking
All visible objects (deep and non-deep) enter one center-lock pipeline:
1. smallest angular distance,
2. if equal, brightest,
3. deterministic id fallback.

#### AD-5: Performance conservatism
Preserve existing request invalidation/cancellation patterns and avoid additional full-scene passes.

### 2.5 Required component changes

#### 2.5.1 `viewer-shell.tsx`
1. Introduce explicit mode-aware optics selectors:
   - active optics source = main or scope, depending on mode.
2. Keep optics behavior active in main mode at all times.
3. Keep scope overlay optional and presentation-only.
4. Unify center-lock candidate set across deep and existing objects.
5. Apply ranking policy: nearest center, brightness tie-break, deterministic fallback.
6. Ensure magnification impacts projection profile/FOV only.
7. Ensure deep-star emergence filters use aperture-driven logic.

#### 2.5.2 `lib/viewer/settings.ts`
1. Add/adjust state schema to represent:
   - non-persisted main optics defaults,
   - persisted scope optics.
2. Ensure storage write excludes main optics values.
3. Preserve compatibility for prior persisted scope settings.

#### 2.5.3 `components/settings/settings-sheet.tsx`
1. Keep same control labels and visuals.
2. Route slider callbacks to main optics or scope optics based on current mode.
3. Maintain parity between desktop/mobile control surfaces.

#### 2.5.4 `lib/viewer/scope-optics.ts`
1. Update magnification normalization/range for main-view usage to support minimum 0.25x where required.
2. Keep emergence logic aperture-driven.
3. Avoid hidden coupling between magnification and emergence thresholds.

#### 2.5.5 Deep-star data path (`lib/scope/*`, star projection flow)
1. Keep HYG-only behavior for this feature scope.
2. Preserve existing tile/band request lifecycle safety.

### 2.6 Data ownership and persistence rules
- `mainOptics` owned by runtime session state; reset to defaults on new app load.
- `scopeOptics` owned by persisted viewer settings.
- `scopeLensOverlayEnabled` owned by persisted viewer settings (current behavior preserved unless changed elsewhere).

### 2.7 Algorithm flow (target)
1. Load viewer settings and initialize runtime defaults.
2. Resolve active mode (scope lens on/off).
3. Select active optics source:
   - main optics when scope is off,
   - scope optics when scope is on.
4. Build projection profile from active magnification.
5. Apply aperture-based deep-star emergence filtering.
6. Project and merge all visible objects.
7. Run unified center-lock ranking.
8. Render labels from shared candidate outputs.
9. Render optional lens overlay if scope mode is enabled.

### 2.8 Testing strategy

#### Unit tests
1. Magnification range supports 0.25x minimum for main optics.
2. Magnification changes FOV only.
3. Aperture changes emergence threshold behavior.
4. Center-lock tie-break order: distance -> brightness -> id.
5. Main optics excluded from persistence payload.
6. Scope optics persisted and restored independently.

#### Integration tests
1. Startup loads main defaults regardless of prior main-session changes.
2. Scope mode retains persisted scope optics while main defaults remain unchanged.
3. Switching modes swaps optics source without UI relabeling.
4. Deep-star center-lock/label eligibility works in both modes.

#### E2E tests
1. Main view load shows sliders and default values.
2. Reload resets main-view optics to defaults.
3. Scope mode reload restores scope optics values.
4. Center-lock winner behavior follows nearest/brightest rules in overlap scenes.
5. Performance baseline remains within existing tolerance bands.

### 2.9 Rollout and safety
1. Implement with minimal surface-area changes and no new framework/runtime layers.
2. Validate behavior parity against current baseline scenes.
3. If regression detected in lock stability or performance, disable new mode wiring path and retain existing scope behavior until corrected.

### 2.10 Risks and mitigations
1. **Risk:** Mixed-mode state confusion.
   - **Mitigation:** strict separation of main vs scope optics state, explicit selector function.
2. **Risk:** Center-lock jitter on ties.
   - **Mitigation:** deterministic third-stage fallback.
3. **Risk:** Performance regressions from extra ranking/filter passes.
   - **Mitigation:** single shared pass, preserve existing fetch invalidation behavior.

---

## 3) Delivery checklist
- [ ] Main optics always active and non-persisted.
- [ ] Main magnification defaults to 1.0x, minimum 0.25x.
- [ ] Scope optics persisted and independent.
- [ ] Same control labels/visuals across modes with independent wiring.
- [ ] Magnification affects FOV only.
- [ ] Aperture controls emergence behavior.
- [ ] Unified center-lock with nearest -> brightest -> deterministic fallback.
- [ ] HYG-only deep-star scope honored.
- [ ] Unit/integration/e2e coverage updated and passing.

