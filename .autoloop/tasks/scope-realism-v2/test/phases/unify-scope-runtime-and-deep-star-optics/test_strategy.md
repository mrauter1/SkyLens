# Test Strategy

- Task ID: scope-realism-v2
- Pair: test
- Phase ID: unify-scope-runtime-and-deep-star-optics
- Phase Directory Key: unify-scope-runtime-and-deep-star-optics
- Phase Title: Apply canonical scope optics across runtime projection, deep-star filtering, and rendering
- Scope: phase-local producer artifact

## Behavior-to-test coverage map
- AC-1 shared magnification-derived FOV:
  - `tests/unit/scope-runtime.test.ts` keeps band selection deterministic for magnification-derived FOV values.
  - `tests/unit/viewer-shell-scope-runtime.test.tsx` verifies magnification changes deep-star spacing while the runtime still fetches/selects scope tiles through the shared effective FOV.
- AC-2 deep-star filtering and retained invariants:
  - `tests/unit/scope-optics.test.ts` covers monotonic limiting-magnitude retention across aperture, transparency, and altitude.
  - `tests/unit/viewer-shell-scope-runtime.test.tsx` covers below-horizon rejection, weak-optics rejection, strong-optics retention, and unchanged likely-visible/daylight suppression of deep-star tile fetches.
- AC-3 profile-driven deep-star rendering:
  - `tests/unit/scope-star-canvas.test.tsx` directly verifies halo/core draw ordering, profile-driven radii/opacity, compact clamping, fallback handling, and preserved `bMinusV` color mapping.
  - `tests/unit/viewer-shell-scope-runtime.test.tsx` verifies runtime photometry response and non-linear size behavior as magnification changes.
- AC-4 regression surfaces:
  - `tests/unit/viewer-settings.test.tsx`, `tests/unit/viewer-shell.test.ts`, and `tests/unit/settings-sheet.test.tsx` remain in the targeted validation set to protect legacy settings compatibility and scope UI state from regression.
  - `tests/unit/scope-lens-overlay.test.tsx` keeps the overlay contract aligned with the new canvas point shape.

## Preserved invariants checked
- Daylight suppression order remains unchanged and still blocks deep-star tile loads before optics filtering.
- Scope stars remain compact even when magnification narrows FOV.
- Deep-star render metadata stays semantically aligned with bright-star `scopeRender` metadata.

## Edge cases / failure paths
- Malformed profile values fall back to compact, finite canvas draw values.
- Below-horizon deep stars are dropped even when they are otherwise bright enough.
- Threshold stars rejected at weak optics are retained once optics improve.

## Stabilization approach
- Use mocked scope catalog fixtures and deterministic demo observer state for runtime tests.
- Use a mocked 2D canvas context that records fill calls instead of pixel snapshots; this avoids jsdom canvas limitations and keeps assertions tied to the actual contract (`intensity`, `corePx`, `haloPx`, `bMinusV`).
- Reuse the existing multi-flush mount helper in `viewer-shell-scope-runtime.test.tsx` to settle async effects deterministically.

## Known gaps
- Broader `npm test` still has unrelated pre-existing failures in `tests/unit/viewer-shell-celestial.test.ts`; this phase does not change that suite.
