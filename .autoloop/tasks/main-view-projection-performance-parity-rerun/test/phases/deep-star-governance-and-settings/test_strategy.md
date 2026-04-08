# Test Strategy

- Task ID: main-view-projection-performance-parity-rerun
- Pair: test
- Phase ID: deep-star-governance-and-settings
- Phase Directory Key: deep-star-governance-and-settings
- Phase Title: Main-View Deep-Star Governance
- Scope: phase-local producer artifact

## Behavior → Coverage Map
- Persisted main-view deep-stars flag with backward-compatible defaults:
  `tests/unit/viewer-settings.test.tsx`
  Covers default-on legacy reads, explicit false persistence, and viewer-shell settings reload paths.
- Settings-sheet control exposure and wiring:
  `tests/unit/settings-sheet.test.tsx`
  Covers the `Main-view deep stars` toggle state and callback dispatch.
- Governor precedence, thresholds, hysteresis, and startup band:
  `tests/unit/scope-optics.test.ts`
  Covers hard-off precedence order, tier promotion/demotion hysteresis, diagnostics reason values, and the documented startup visible-deep-star count band.
- Main-view runtime hard-off behavior and workload reduction:
  `tests/unit/viewer-shell-scope-runtime.test.tsx`
  Covers zero main-view catalog requests when the persisted toggle is off.
- Main-view silence/focus rules:
  `tests/unit/viewer-shell-scope-runtime.test.tsx`
  Covers center-lock/on-object participation, non-focused marker-label silence, and co-located bright-object focus winning over deep-star overlays.
- Scope-mode preserved invariants:
  `tests/unit/viewer-shell-scope-runtime.test.tsx`
  Covers scope deep-star rendering remaining active even when the main-view toggle is off.
- Dev diagnostics:
  `tests/unit/viewer-shell.test.ts`
  Covers development-only main-view deep-star diagnostics for tier, decision source, and transition reason alongside orientation diagnostics.
- Shared B-V color semantics:
  `tests/unit/viewer-shell-scope-runtime.test.tsx`
  `tests/unit/scope-star-canvas.test.tsx`
  Covers focused main-view deep-star marker coloring and the shared scope-canvas palette bands.

## Preserved Invariants Checked
- Scope-mode band selection and scope lens rendering remain independent of the new main-view toggle.
- Main-view deep-star hard-off gates still layer on top of existing observer, stars-layer, and daylight suppression rules.
- Previously completed non-scope projection parity coverage remains intact in adjacent suites and was left unchanged.

## Edge Cases / Failure Paths
- Legacy settings payloads missing the new flag default to enabled.
- Hard-off precedence is deterministic when multiple gates are false/disabled simultaneously.
- Hysteresis tests pin boundary-crossing behavior to prevent oscillation regressions.
- Main-view disabled mode asserts runtime work reduction via zero catalog/tile requests, not just empty DOM output.

## Flake Controls
- Deep-star runtime tests use synthetic scope datasets, deterministic observer fixtures, and mocked fetch/canvas plumbing.
- Diagnostics assertions stay DOM-text based and avoid timing-sensitive polling.

## Known Gaps
- No new end-to-end browser test was added in this phase; coverage remains at the deterministic unit/integration level used by the task validation commands.
