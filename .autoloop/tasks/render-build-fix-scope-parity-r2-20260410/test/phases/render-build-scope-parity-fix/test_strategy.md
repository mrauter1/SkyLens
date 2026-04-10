# Test Strategy

- Task ID: render-build-fix-scope-parity-r2-20260410
- Pair: test
- Phase ID: render-build-scope-parity-fix
- Phase Directory Key: render-build-scope-parity-fix
- Phase Title: Fix browser-safe satellite import and preserve scope parity
- Scope: phase-local producer artifact

## Behavior-to-coverage map
- Browser-safe `satellite.js` wrapper path: `SkyLensServerless/tests/unit/viewer-motion.test.ts`
  - Added a source-level regression test that fails if `lib/vendor/satellite.ts` reverts to `from 'satellite.js'` or drops any of the required browser-safe dist entrypoints.
- Motion wrapper contract still functions for downstream consumers: `SkyLensServerless/tests/unit/viewer-motion.test.ts`
  - Existing deterministic satellite propagation and shared motion pipeline tests continue to exercise `lib/viewer/motion.ts` through the local wrapper.
- Scope parity invariants remain preserved: `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`, `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  - Non-bright lens class parity.
  - Wide-stage visibility and clickability outside the lens.
  - Motion-affordance anchoring and stage-vs-lens ownership.
- Settings compatibility remains preserved: `SkyLensServerless/tests/unit/viewer-settings.test.tsx`, `/workspace/SkyLens/tests/unit/viewer-settings.test.tsx`
  - Canonical `scopeModeEnabled` precedence over legacy `scope.enabled`.

## Edge cases and failure paths
- Wrapper regression edge case: the new test catches a silent source-level revert to the package root import before it manifests as a stalled production build.
- Build-path failure coverage: `cd SkyLensServerless && npm run build` confirms Next 16 static export still completes with the wrapper pinned to browser-safe entrypoints.

## Flake risks and stabilization
- Wrapper regression test is file-content based and avoids timing, network, rendering, or environment variability.
- Scope/runtime coverage continues to use the existing deterministic mocks and local fixtures.

## Known gaps
- The wrapper regression test intentionally verifies the import-path contract rather than webpack module-resolution internals; the production build remains the end-to-end guard for that surface.
