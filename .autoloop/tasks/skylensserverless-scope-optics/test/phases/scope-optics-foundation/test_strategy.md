# Test Strategy

- Task ID: skylensserverless-scope-optics
- Pair: test
- Phase ID: scope-optics-foundation
- Phase Directory Key: scope-optics-foundation
- Phase Title: Settings and Optics Foundation
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- Settings defaults and clamps:
  - `tests/unit/viewer-settings.test.tsx`
  - Covers legacy payload reads with missing scope fields, partial nested `scopeOptics`, clamp ranges, and write/read round-trip of persisted nested scope settings.
- Locked optics formulas:
  - `tests/unit/scope-optics.test.ts`
  - Covers deterministic golden outputs, monotonic limiting-magnitude changes for aperture/magnification/transparency/altitude, visibility threshold behavior, and compact photometric growth.
- Star-pipeline ordering and filtering:
  - `tests/unit/stars-scope-pipeline.test.ts`
  - Covers likely-visible/daylight suppression before horizon/scope work, horizon exclusion, absence of `scopeRender` when scope mode is off, scope-only filtering of dim stars, and `scopeRender` metadata attachment on passing stars.
- Bundled-catalog non-regression:
  - `tests/unit/celestial-layer.test.ts`
  - Covers unchanged daylight suppression with real fixtures and verifies that scope mode is the only condition that adds render metadata to the bright bundled star set.
- Viewer wiring:
  - `tests/unit/viewer-shell-celestial.test.ts`
  - Covers forwarding of persisted `scopeModeEnabled` and `scopeOptics` into `normalizeVisibleStars`.

## Preserved invariants checked

- Existing `likelyVisibleOnly` daylight behavior still suppresses stars before scope logic runs.
- Horizon gating still excludes negative-altitude stars before scope filtering.
- `scopeRender` remains absent when scope mode is off.
- Existing storage key remains readable and older payloads without scope fields still normalize safely.

## Edge cases and failure paths

- Partial nested optics payloads default missing fields instead of breaking reads.
- Out-of-range optics payloads clamp to locked minimum/maximum values.
- Dim stars beyond the limiting magnitude are filtered while brighter peers remain visible in the mocked pipeline.

## Flake risks and stabilization

- Viewer-shell tests use mocked astronomy/motion dependencies and existing `flushEffects` helpers to avoid timing and network nondeterminism.
- Star-pipeline filtering uses mocked catalog and horizon data because the bundled `stars_200` catalog is too bright to naturally exercise the limiting-magnitude cutoff.

## Known gaps

- This phase does not cover the later UI-control relocation or renderer consumption of `scopeRender`; those belong to the next viewer integration phase.
