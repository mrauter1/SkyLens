# Test Strategy

- Task ID: autoloop-task-implement-skylensserverless-scope-05c699dd
- Pair: test
- Phase ID: compact-deep-star-render-retune
- Phase Directory Key: compact-deep-star-render-retune
- Phase Title: Compact deep-star canvas retune
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Compact radius envelopes:
  - `tests/unit/scope-star-canvas.test.tsx`
  - verifies compressed halo/core radii clamp into `1.4-3.6px` and `0.9-2.2px`
- Radial-gradient halo path:
  - `tests/unit/scope-star-canvas.test.tsx`
  - verifies gradient creation, gradient center/edge stops, and monotonic halo falloff
- Halo suppression threshold:
  - `tests/unit/scope-star-canvas.test.tsx`
  - verifies no halo draw when compressed core radius stays below `1.15px`
- Deterministic fallback path:
  - `tests/unit/scope-star-canvas.test.tsx`
  - forces gradient creation failure and verifies solid halo rendering still occurs deterministically
- Preserved color semantics:
  - `tests/unit/scope-star-canvas.test.tsx`
  - verifies unchanged B-V buckets across blue, neutral, warm, red, and invalid-input cases
- Preserved runtime invariants:
  - `tests/unit/viewer-shell-scope-runtime.test.tsx`
  - verifies below-horizon rejection, optics limiting-magnitude behavior, magnification-driven spacing, and daylight suppression

## Preserved invariants checked

- `scopeOptics.magnificationX` remains the runtime source of magnification behavior.
- Renderer tuning stays local to the canvas layer; runtime gating order is unchanged.
- No `.bin` dataset artifacts are introduced by this phase.

## Edge cases and failure paths

- Oversized incoming profile radii clamp to the compact envelopes.
- Tiny compressed cores suppress the halo pass.
- Gradient creation failure falls back to a solid halo fill with deterministic alpha.
- Invalid `bMinusV` values keep the existing fallback color semantics.

## Flake risks and stabilization

- Canvas behavior is fully stubbed to avoid pixel snapshots and browser-dependent rendering.
- Runtime tests use deterministic mocked data/catalog responses and stable geometry setup.
- The runtime canvas stub exposes `createRadialGradient` so invariant tests follow the production halo branch without asserting on gradient internals.

## Known gaps

- No image/snapshot tests are added; visual validation remains contract-based through deterministic canvas-call assertions.
