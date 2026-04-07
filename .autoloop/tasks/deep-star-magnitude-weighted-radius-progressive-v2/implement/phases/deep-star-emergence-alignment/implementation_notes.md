# Implementation Notes

- Task ID: deep-star-magnitude-weighted-radius-progressive-v2
- Pair: implement
- Phase ID: deep-star-emergence-alignment
- Phase Directory Key: deep-star-emergence-alignment
- Phase Title: Deep Star Emergence Alignment
- Scope: phase-local producer artifact

## Files changed

- `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`

## Symbols touched

- `ViewerShell scope runtime` test: `progressively reveals deep stars as aperture increases while keeping radius fixed`
- `ViewerShell scope runtime` test: `renders brighter deep stars with larger canvas radii than dimmer deep stars`

## Checklist mapping

- Emergence helper thresholds/finite-safe behavior: verified against existing `scope-optics` helper implementation; no production edit required.
- Magnitude-only radius behavior: verified against existing helper/runtime implementation; no production edit required.
- Viewer-shell explicit canvas alpha/radius mapping: added runtime assertions that rendered canvas alpha/radius match `computeScopeLimitingMagnitude` + `computeScopeDeepStarEmergenceAlpha` and `computeScopeDeepStarCoreRadiusPx`.
- Core-only canvas / no halo behavior: covered by existing focused canvas tests; no production edit required in this phase.

## Assumptions

- The checked-in production implementation in `scope-optics.ts`, `viewer-shell.tsx`, and `scope-star-canvas.tsx` is authoritative for this phase because it already matches the PRD-required behavior and acceptance criteria.

## Preserved invariants

- `passesScopeLimitingMagnitude` remains the pre-render physical gate for deep stars.
- Deep-star radius remains magnitude-derived and aperture-invariant.
- Deep stars remain canvas-only and core-only with no halo path added.
- Existing altitude and daylight suppression behavior remains unchanged.

## Intended behavior changes

- None in production code.
- Runtime coverage now asserts exact helper-to-canvas alpha/radius mapping, not just relative emergence behavior.

## Known non-changes

- No scope control UI changes.
- No aperture-based radius scaling.
- No halo rendering changes.
- No change to bright-object scope marker behavior.

## Expected side effects

- The runtime deep-star radius comparison fixture now uses an optics-visible dim star (`vMag 6.9`) so the test exercises the preserved limiting-magnitude gate instead of depending on an out-of-gate star.

## Validation performed

- `npm ci`
- `npm exec vitest -- run tests/unit/scope-optics.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/scope-star-canvas.test.tsx`
- Result: `3` test files passed, `26` tests passed.

## Deduplication / centralization decisions

- Reused the existing optics helpers in runtime assertions rather than adding new mapping helpers or alternative test-only abstractions.
