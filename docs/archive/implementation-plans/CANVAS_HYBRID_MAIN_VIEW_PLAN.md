# SkyLensServerless Plan: Main-View Hybrid Rendering (Canvas for Dense Stars + DOM for Interactive Objects/Labels)

## 0) Objective
Implement a **hybrid main-view renderer** that keeps:
- **Canvas** for high-cardinality star field rendering (especially deep stars), and
- **DOM** only for interactive/selectable objects and label surfaces.

The goal is to improve frame stability and reduce DOM pressure in non-scope mode while preserving all existing interaction and accessibility semantics.

---

## 1) What the codebase does today (confirmed)

### 1.1 Scope-mode canvas path exists and is gated
- `ViewerShell` mounts `ScopeLensOverlay` only when `hasMounted && scopeModeActive`.
- `ScopeLensOverlay` composes visual lens layers and renders stars via `ScopeStarCanvas`.
- `ScopeStarCanvas` draws stars with batched 2D canvas arcs.

### 1.2 Main view currently renders deep stars as DOM markers
- `projectedDeepStars` are computed in shared projection flow.
- When scope mode is off, `mainViewRenderedDeepStars` are appended into `markerObjects`.
- `renderedMarkerObjects` become interactive DOM buttons (`data-testid="sky-object-marker"`).

### 1.3 Current behavior contracts to preserve
- Deep stars in non-scope mode participate in:
  - center-lock,
  - label layout modes (`center_only`, `on_objects`, `top_list`),
  - selection/hover detail flows.
- Existing tests explicitly assert this non-scope behavior.

### 1.4 Existing ADR direction supports this change
- Scope overlay is presentation-oriented; optics/projection should be shared.
- This hybrid plan keeps shared optics math and changes only rendering surfaces.

---

## 2) Constraints and regression boundaries

## 2.1 Must remain unchanged
1. **Center-lock candidate set and ranking logic** (nearest center, brightness tie-break, deterministic fallback).
2. **Label-candidate source set** and ranking behavior.
3. **Selection/hover/detail panel semantics**.
4. **Accessibility for interactive objects** (keyboard focus, ARIA labels, button semantics).
5. **Scope-mode lens behavior** and its canvas contracts.
6. **Main-view optics/scope-optics state ownership and persistence semantics**.

### 2.2 Allowed to change
1. Non-scope deep-star visual surface from DOM markers to canvas points.
2. Main-view marker list composition so deep stars are excluded from interactive marker DOM.
3. Visual parity tuning for deep-star color/alpha/radius mapping in main view.

---

## 3) Target architecture

## 3.1 New rendering split (non-scope mode)
- **Canvas layer (new):** renders non-interactive deep-star field in full viewport.
- **DOM marker layer (existing):** renders interactive bright objects (sun, moon, planets, bright stars, satellites, aircraft, constellations when applicable).
- **DOM labels layer (existing):** unchanged; uses existing label placement and candidate logic.

## 3.2 Keep object-model logic unified
Retain a single canonical `projectedDeepStars` pipeline for:
- center-lock,
- label candidates,
- diagnostics,
- detail summaries.

Only final draw surface changes for deep stars in non-scope mode.

## 3.3 New component
Create a reusable viewport canvas component for star points (e.g., `main-star-canvas.tsx`):
- same core draw strategy as `ScopeStarCanvas` (single pass arcs),
- configurable dimensions to viewport,
- accepts point payload with `x,y,bMinusV,alpha,radius`,
- no pointer events.

Optional implementation variant: generalize `ScopeStarCanvas` into a shared `StarPointCanvas` and reuse for both scope and main view to reduce duplication.

---

## 4) Detailed implementation plan (no code yet)

## Pair 1 — Extract data surfaces without behavioral change

### Plan
1. Introduce explicit computed arrays in `viewer-shell.tsx`:
   - `nonScopeDeepStarCanvasPoints` (deep stars visible in main view, mapped to point payload),
   - `interactiveMarkerObjects` (marker objects excluding deep stars in non-scope mode).
2. Keep center-lock and label logic untouched and still based on full logical object sets.

### Implement
- Add derivation helpers only; do not alter rendered output in this pair.

### Test
- Existing tests should pass unchanged.
- Add focused unit assertions for new derivations (if helper extraction occurs).

---

## Pair 2 — Introduce main-view star canvas component

### Plan
1. Add `MainStarCanvas` (or shared `StarPointCanvas`) component under `components/viewer/`.
2. Reuse established clamping semantics from scope canvas for radius/alpha safety.
3. Preserve B-V color mapping parity via existing star color utility.

### Implement
- Add component with deterministic rendering and no halo unless explicitly required.
- Mount this canvas in non-scope mode at full viewport dimensions, under interactive DOM markers and labels.

### Test
- Add unit tests analogous to `scope-star-canvas.test.tsx` for:
  - one fill per point,
  - color mapping,
  - alpha/radius clamping,
  - DPR-aware sizing.

---

## Pair 3 — Switch non-scope deep stars from DOM markers to canvas

### Plan
1. Replace non-scope deep-star entries in rendered marker map with canvas payload.
2. Keep deep stars in center-lock and label candidate pipelines.
3. Ensure selected/center-locked deep stars remain represented in UI copy even if not clickable markers.

### Implement
- In marker rendering loop, include only `interactiveMarkerObjects`.
- Render `MainStarCanvas` for deep stars in non-scope mode.
- Keep `on-object`/`center-only`/`top-list` label behavior driven by existing candidate sets.

### Test
- Update tests that currently assert deep stars are DOM markers in non-scope mode.
- Replace with assertions for:
  - canvas draw presence/count,
  - unchanged center-lock winner,
  - unchanged label presence.

---

## Pair 4 — Regression hardening and parity checks

### Plan
1. Validate interaction behavior for bright objects is unchanged.
2. Validate scope mode remains unchanged.
3. Validate performance-sensitive paths and no extra scene passes.

### Implement
- Tighten render dependencies for point arrays (memoization where appropriate).
- Ensure canvas re-draw is bounded to relevant inputs.

### Test
- Run targeted test groups and then full suite in `SkyLensServerless`.
- Add non-scope hybrid-specific regression tests for:
  - label overlap stability,
  - center-lock tie-breaks with deep stars,
  - selected-detail fallback when deep stars are label-only/canvas-only.

---

## 5) Concrete file-level change plan

1. **`SkyLensServerless/components/viewer/viewer-shell.tsx`**
   - Add non-scope deep-star canvas point derivation.
   - Split interactive marker list from logical object list.
   - Mount new main-view canvas in non-scope path.
   - Keep center-lock/labels on full logical sets.

2. **`SkyLensServerless/components/viewer/main-star-canvas.tsx`** *(new)*
   - Canvas drawing component for viewport star points.

3. **`SkyLensServerless/components/viewer/scope-star-canvas.tsx`** *(optional refactor)*
   - If shared canvas abstraction is introduced, adapt this component to compose shared primitive.

4. **Tests**
   - `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
   - `SkyLensServerless/tests/unit/viewer-shell.test.ts`
   - `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`
   - `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx` (and/or new `main-star-canvas.test.tsx`)

---

## 6) Regression checklist (must pass before merge)

1. Non-scope mode:
   - deep stars still influence center-lock.
   - deep stars still appear in label modes.
   - deep stars no longer create interactive marker buttons.
2. Scope mode:
   - no change to lens overlay mounting and canvas behavior.
3. Bright-object interactions:
   - click/hover/select behavior unchanged.
4. Diagnostics and summary cards:
   - deep-star data still visible in summary/detail flows when relevant.
5. No performance regressions from accidental duplicate passes.

---

## 7) Test execution plan

## 7.1 Targeted unit suites first
1. `tests/unit/scope-star-canvas.test.tsx` (+ new main canvas tests).
2. `tests/unit/viewer-shell-scope-runtime.test.tsx`.
3. `tests/unit/viewer-shell.test.ts`.
4. `tests/unit/viewer-shell-celestial.test.ts`.
5. `tests/unit/viewer-settings.test.tsx` (state and controls regression guard).

## 7.2 Full app tests
- Run full `SkyLensServerless` test command after targeted suite passes.

## 7.3 Manual verification checklist
1. Toggle scope mode on/off while tracking same scene.
2. Verify deep-star density in non-scope improves without interaction lag.
3. Verify bright marker tapping still opens details.
4. Verify keyboard navigation to interactive markers remains valid.

---

## 8) Risk analysis and mitigations

1. **Risk:** Losing deep-star visibility in labels after DOM marker removal.
   - **Mitigation:** Keep label candidates sourced from logical object sets, not marker DOM set.

2. **Risk:** Center-lock drift if candidate source accidentally narrowed.
   - **Mitigation:** Preserve center-lock input arrays exactly as today; only alter render lists.

3. **Risk:** Visual mismatch between scope and non-scope deep stars.
   - **Mitigation:** Reuse same B-V color + alpha/radius normalization semantics.

4. **Risk:** Overdraw/perf regressions from repeated canvas invalidations.
   - **Mitigation:** Memoize point payloads and redraw only on dimension/data changes.

5. **Risk:** Accessibility regressions if interactive DOM is unintentionally reduced.
   - **Mitigation:** Restrict canvas-only conversion to non-interactive deep stars.

---

## 9) Rollout strategy

1. Land behind a temporary internal feature flag (if available) for fast rollback.
2. Validate on at least one mobile and one desktop viewport.
3. Remove flag once test suite and manual checks are stable.

---

## 10) Acceptance criteria for this request

The request is complete when all are true:
1. In **normal view mode**, dense/deep star field renders via canvas.
2. In **normal view mode**, DOM renders only interactive/selectable objects and labels.
3. Center-lock, labels, detail cards, and optics semantics are unchanged.
4. Scope-mode rendering contracts remain unchanged.
5. Unit/integration tests covering these paths pass without regressions.
