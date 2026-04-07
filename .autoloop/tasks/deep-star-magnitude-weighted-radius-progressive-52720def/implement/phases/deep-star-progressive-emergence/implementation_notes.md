# Implementation Notes

- Task ID: deep-star-magnitude-weighted-radius-progressive-52720def
- Pair: implement
- Phase ID: deep-star-progressive-emergence
- Phase Directory Key: deep-star-progressive-emergence
- Phase Title: Deep-Star Emergence And Radius Rework
- Scope: phase-local producer artifact

## Files changed
- `.autoloop/tasks/deep-star-magnitude-weighted-radius-progressive-52720def/decisions.txt`
- `.autoloop/tasks/deep-star-magnitude-weighted-radius-progressive-52720def/implement/phases/deep-star-progressive-emergence/implementation_notes.md`

## Symbols touched
- none; this turn validated the already-correct `computeScopeDeepStarCoreRadiusPx` implementation in the current repository state

## Checklist mapping
- Milestone 1: verified the existing magnitude-radius helper normalization in `scope-optics.ts` already maps bright stars to the larger core radius envelope and faint stars to the smaller one, so no additional source edit was required in this turn.
- Milestone 2: verified the current `viewer-shell` deep-star canvas mapping already derives alpha from emergence and radius from magnitude only, so no mapper change was needed in this turn.
- Milestone 3: verified the current `ScopeStarCanvas` path remains core-only with explicit radius/alpha inputs and no halo path, so no renderer change was needed in this turn.
- Milestone 4: reran the targeted unit-test slice for helper/runtime/canvas/celestial regression coverage; execution is still blocked by missing local Vitest dependencies in this checkout.

## Assumptions
- Deep-star progressive emergence should start only after the existing `passesScopeLimitingMagnitude` inclusion gate, not before it.
- Existing `scopeRender` metadata remains available for non-canvas consumers even though deep-star canvas alpha/radius no longer use its aperture-shaped intensity/core values directly.

## Preserved invariants
- `passesScopeLimitingMagnitude` and `computeScopeLimitingMagnitude` remain unchanged and continue to control deep-star inclusion.
- Low-altitude suppression, daylight suppression, scope control semantics, and core-only rendering remain unchanged.
- B-V color mapping remains unchanged.

## Intended behavior changes
- No new runtime behavior change was introduced in this turn; reviewer finding `IMP-001` is resolved in the current repository state because `computeScopeDeepStarCoreRadiusPx` already maps `mag=1.5` to `2.5px` and `mag=10.5` to `1.0px`.

## Known non-changes
- `viewer-shell.tsx` deep-star mapping was left unchanged because it already uses the existing gate plus explicit emergence alpha and magnitude radius helpers.
- `scope-star-canvas.tsx` was left unchanged because it already renders a single core pass from explicit radius and alpha without a halo path.
- `computeScopeRenderProfile` is still emitted into metadata for shared consumers.
- No halo rendering path was reintroduced.
- No scope UI layout or optics control behavior changed.

## Expected side effects
- Deep-star size ordering now matches the intended astrophotography-style brightness weighting, with bright stars larger than faint stars at the same aperture.

## Validation performed
- Verified the corrected helper numerically with a local Node check: `mag=1.5 -> 2.5px`, `mag=6 -> 1.8321771040508839px`, `mag=10.5 -> 1px`, `mag=18 -> 1px`.
- Attempted targeted tests:
  - `npx vitest run SkyLensServerless/tests/unit/scope-optics.test.ts SkyLensServerless/tests/unit/scope-star-canvas.test.tsx SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx SkyLensServerless/tests/unit/celestial-layer.test.ts`
  - Startup still fails in this checkout because `SkyLensServerless/vitest.config.ts` cannot resolve `vitest/config` from the local dependency tree.

## Deduplication / centralization
- Deep-star magnitude-radius shaping remains centralized in `scope-optics.ts`.
- No additional logic was duplicated into `viewer-shell` or `ScopeStarCanvas`; both continue to consume the centralized helper output.
