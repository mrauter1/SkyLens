# Test Strategy

- Task ID: scope-realism-final-v5-autoloop
- Pair: test
- Phase ID: verification
- Phase Directory Key: verification
- Phase Title: Targeted regression coverage and task completion checks
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Core-only deep-star rendering:
  `SkyLensServerless/tests/unit/scope-star-canvas.test.tsx`
  covers one draw pass per star, halo-path removal, compact radius clamps, alpha clamps, and preserved B-V color mapping.
- Settings migration and persistence:
  `SkyLensServerless/tests/unit/viewer-settings.test.tsx`
  covers `scopeLensDiameterPct` defaulting, clamping, persistence, and backward-compatible reads alongside preserved scope migration behavior.
- Telescope diameter UI wiring:
  `SkyLensServerless/tests/unit/settings-sheet.test.tsx`
  covers conditional rendering of the telescope diameter control and callback delegation without moving normalization into the sheet.
- Runtime scope realism:
  `SkyLensServerless/tests/unit/viewer-shell-scope-runtime.test.tsx`
  covers aperture-only deep-star dimming after inclusion, below-horizon rejection, daylight suppression, magnification-driven bright-object sizing, opacity monotonicity, standard viewport lens sizing, and narrow-portrait lens-range remapping.
- Broader regression watchlist:
  `SkyLensServerless/tests/unit/viewer-shell.test.ts`,
  `SkyLensServerless/tests/unit/viewer-shell-celestial.test.ts`,
  and `SkyLensServerless/tests/unit/scope-lens-overlay.test.tsx`
  cover settings callback wiring, scope overlay sizing/order, and bright-object marker rendering around the lens overlay.

## Preserved invariants checked

- `haloPx` remains payload-compatible while rendering stays single-pass core-only.
- Deep-star gating order remains daylight -> horizon -> limiting magnitude -> render profile -> display-only aperture dimming.
- `scopeLensDiameterPct` remains viewer-settings-owned and normalized centrally.
- Scope lens diameter remains viewport-safe while still responding monotonically across supported values on narrow portrait layouts.

## Edge cases

- Invalid or missing persisted telescope diameter values fall back to defaults or clamps.
- Very small/narrow portrait viewports do not flatten every supported diameter percentage to one constant lens size.
- Daylight suppression still prevents scope deep-star tile fetches when likely-visible gating would hide them.

## Failure paths / stabilization

- Canvas rendering is stubbed so draw-call assertions stay deterministic and do not depend on a real browser canvas implementation.
- Scope catalog fetches use synthetic datasets and explicit stale-response control to keep network-related behavior deterministic.
- Broader watchlist still emits jsdom `getContext()` warnings in some paths, but the suite remains deterministic and passes without timing flakes.

## Validation performed

- Passed required command:
  `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/settings-sheet.test.tsx`
- Passed broader watchlist command:
  `npm test -- tests/unit/scope-star-canvas.test.tsx tests/unit/scope-optics.test.ts tests/unit/scope-runtime.test.ts tests/unit/viewer-shell-scope-runtime.test.tsx tests/unit/viewer-settings.test.tsx tests/unit/viewer-shell.test.ts tests/unit/viewer-shell-celestial.test.ts tests/unit/settings-sheet.test.tsx tests/unit/scope-lens-overlay.test.tsx`
- Confirmed no `.bin` additions with `git status --short -- '*.bin'`.
- Confirmed no `.bin` files under `SkyLensServerless/` with `find SkyLensServerless -type f -name '*.bin'`.

## Known gaps

- No snapshot/golden visual infrastructure was added because it is explicitly out of scope for this phase.
